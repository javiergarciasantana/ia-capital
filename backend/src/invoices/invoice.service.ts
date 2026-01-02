import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice.entity';
import { InvoicePdf } from './invoicePdf.entity';
import { UsersService } from '../users/users.service';
import { ReportsService } from '../reports/reports.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoicePdf) private invoicePdfRepo: Repository<InvoicePdf>,
    private readonly usersService: UsersService,
    private readonly reportsService: ReportsService,
  ) {}

  // --- AUTOMATIC GENERATION (CRON) ---
  // Runs at midnight on the 1st of every month
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Checking for invoices to generate...');
    const today = new Date();
    const month = today.getMonth(); // 0 = Jan, 1 = Feb, etc.

    // Quarterly months: Jan(0), Apr(3), Jul(6), Oct(9)
    const isQuarterlyMonth = [0, 3, 6, 9].includes(month);
    
    // Biannual months: Jan(0), Jul(6)
    const isBiannualMonth = [0, 6].includes(month);

    if (!isQuarterlyMonth && !isBiannualMonth) {
      return;
    }

    const clients = await this.usersService.findAllClients();

    for (const client of clients) {
      if (!client.profile) continue;

      const interval = client.profile.feeInterval; // 'quarterly' | 'biannual'
      
      let shouldGenerate = false;
      if (interval === 'quarterly' && isQuarterlyMonth) shouldGenerate = true;
      if (interval === 'biannual' && isBiannualMonth) shouldGenerate = true;

      if (shouldGenerate) {
        await this.generateInvoiceForClient(client.id);
      }
    }
  }

  // --- CORE LOGIC ---
  async generateInvoiceForClient(clientId: number) {
    const client = await this.usersService.findById(clientId);
    if (!client || !client.profile) {
      this.logger.warn(`Client ${clientId} not found or has no profile.`);
      return;
    }
    
    // 1. Get Last Report for Net Worth
    // Assuming getReportsForUser returns sorted by date DESC. If not, we need to sort.
    const reports = await this.reportsService.getReportsForUser(clientId);
    if (!reports || reports.length === 0) {
      this.logger.warn(`No reports found for client ${client.email}. Cannot calculate fee.`);
      return;
    }
    
    // Sort just in case to get the absolute latest
    const lastReport = reports.sort((a: any, b: any) => new Date(b.fechaInforme).getTime() - new Date(a.fechaInforme).getTime())[0];
    const existingInvoice = await this.invoiceRepo.findOne({ where: { report: lastReport }, relations: ['invoicePdf'] });

    if(existingInvoice) {
      // Remove the invoice reference from lastReport since it's a one-to-one relation
      this.logger.warn(`Factura ya generada`);
      const invoice = await this.getInvoice(lastReport.invoice.id);

      await this.deleteInvoice(existingInvoice.id);
      return await this.generateInvoiceForClient(clientId);
    }
    
    const patrimonioNeto = lastReport.snapshot?.patrimonioNeto || 0;
    
    // 2. Calculate Amount
    // Formula: (patrimoioNeto * feePercentage) * parse(feeInterval)
    const feePercentage = client.profile.feePercentage || 0; // e.g. 0.01 for 1%
    const interval = client.profile.feeInterval;
    
    let timeFactor = 0;
    if (interval === 'quarterly') timeFactor = 0.25;
    else if (interval === 'biannual') timeFactor = 0.5;
    
    const amount = ((patrimonioNeto) * feePercentage) * timeFactor;
    
    if (amount <= 0) {
      this.logger.log(`Calculated amount is 0 for client ${client.email}. Skipping.`);
      return;
    }
    // 3. Create Invoice Record
    const newInvoice = this.invoiceRepo.create({
      clienteId: client.id,
      fechaFactura: new Date(),
      descripcion: `Management Fee - ${(interval ?? 'undefined').charAt(0).toUpperCase() + (interval ?? 'undefined').slice(1)} (${new Date().getFullYear()})`,
      importe: parseFloat(amount.toFixed(2)),
      report: lastReport
      
    });
    
    const savedInvoice = await this.invoiceRepo.save(newInvoice);
    // Update lastReport to add savedInvoice as attribute 'invoice'
    lastReport.invoice = savedInvoice;
    await this.reportsService.updateReport(lastReport.id, lastReport);

    // 4. Generate PDF
    const pdfBuffer = await this.generateClassyPdf(newInvoice, client, patrimonioNeto, feePercentage, timeFactor);
    
    // 5. Save PDF to disk (or upload to S3)
    const fileName = `invoice_${newInvoice.id}_${client.id}.pdf`;
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'invoices');
    
    if (!fs.existsSync(uploadDir)){
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(uploadDir, fileName), pdfBuffer);

    const newPdf = this.invoicePdfRepo.create({
      pdf: pdfBuffer,
      clienteId: clientId,
      invoice: savedInvoice
    })

    const savedPdf = await this.invoicePdfRepo.save(newPdf);  
    savedInvoice.invoicePdf = savedPdf;  
    await this.updateInvoice(savedInvoice.id, savedInvoice);
    this.logger.log(`Invoice generated for ${client.email}: ${amount} ${client.profile.preferredCurrency}`);
    
    return { invoice: savedInvoice, pdf: pdfBuffer };
  }

  // --- PDF GENERATION ---
  private async generateClassyPdf(invoice: Invoice, client: any, netWorth: number, percentage: number, timeFactor: number): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const currency = client.profile.preferredCurrency || 'EUR';
      const locale = currency === 'USD' ? 'en-US' : 'es-ES';
      const fmt = (num: number) => num.toLocaleString(locale, { style: 'currency', currency: currency });

      // --- HEADER ---
      const logoPath = path.join(__dirname, '..', 'common', 'logo.png'); // Adjust path as needed
      console.log("logopath", logoPath);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 40, { width: 120 }); // x, y, width
      }

      // --- DIVIDER ---
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, 130).lineTo(550, 130).stroke();
      doc.moveDown(2);

      // --- CLIENT INFO & INVOICE DETAILS ---
      const topY = 150;
      
      // Left: Client
      doc.text('BILL TO:', 50, topY, { underline: true });
      doc.font('Helvetica-Bold').fontSize(14).text(`${client.profile.firstName} ${client.profile.lastName ?? ''}`);
      doc.font('Helvetica').fontSize(10).text(client.email);
      if(client.profile.address) doc.text(client.profile.address);
      if(client.profile.city) doc.text(`${client.profile.city}, ${client.profile.country || ''}`);

      // Right: Invoice Meta
      doc.fontSize(10).font('Helvetica-Bold').text('INVOICE #', 400, topY);
      doc.font('Helvetica').text(invoice.id.toString().padStart(6, '0'), 400, topY + 15);
      
      doc.font('Helvetica-Bold').text('DATE', 400, topY + 35);
      doc.font('Helvetica').text(invoice.fechaFactura.toLocaleDateString(), 400, topY + 50);

      doc.moveDown(4);

      // --- TABLE HEADER ---
      const tableTop = 300;
      doc.rect(50, tableTop, 500, 30).fill('#f8fafc'); // Light gray background
      doc.fillColor('#1a2340').font('Helvetica-Bold').fontSize(10);
      doc.text('DESCRIPTION', 60, tableTop + 10);
      doc.text('AMOUNT', 0, tableTop + 10, { align: 'right' });

      // --- TABLE ROW ---
      const rowY = tableTop + 40;
      doc.fillColor('#000').font('Helvetica').fontSize(10);
      
      doc.text(invoice.descripcion, 60, rowY);
      doc.text(fmt(invoice.importe), 0, rowY, { align: 'right' });

      // --- CALCULATION DETAILS (Subtext) ---
      doc.fillColor('#6b7280').fontSize(8); // Gray text
      const calcText = `Calculation: Net Worth (${fmt(netWorth)}) x Fee (${(percentage * 100).toFixed(2)}%) x Period Factor (${timeFactor})`;
      doc.text(calcText, 60, rowY + 15);

      // --- TOTAL ---
      const totalY = rowY + 50;
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, totalY - 10).lineTo(550, totalY - 10).stroke();
      
      doc.fillColor('#1a2340').fontSize(12).font('Helvetica-Bold');
      doc.text('TOTAL DUE', 350, totalY);
      doc.fontSize(16).text(fmt(invoice.importe), 0, totalY - 3, { align: 'right' });

      // --- FOOTER ---
      const bottomY = 700;
      doc.fontSize(8).font('Helvetica').fillColor('#9ca3af');
      doc.text('Thank you for your trust.', 50, bottomY, { align: 'center' });
      doc.text('Please remit payment within 30 days.', 50, bottomY + 12, { align: 'center' });

      doc.end();
    });
  }


  async getAllInvoicePdfs(): Promise<InvoicePdf[]> {
    return this.invoicePdfRepo.find();
  }

  async getInvoice(id: Number): Promise<Invoice | null> {
    return this.invoiceRepo.findOne({
      where: {
        id: Number(id),
      },
      relations: ['invoicePdf']
    });
  }

  async getUserInvoices(id: Number): Promise<Invoice[]> {
    return this.invoiceRepo.find( {
      where: {
        clienteId: Number(id),
      },
    })
  }


  async getUserInvoicePdfs(id: Number): Promise<InvoicePdf[]> {
    return this.invoicePdfRepo.find( {
      where: {
        clienteId: Number(id),
      },
    })
  }

  async updateInvoice(invoiceId: number, invoiceDto: any) {
    // Find the invoice by ID
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
      throw new Error(`Invoice with id ${invoiceId} not found`);
    }
    // Update invoice fields
    Object.assign(invoice, invoiceDto);
    return this.invoiceRepo.save(invoice);
  }

  async deleteInvoice(invoiceId: number): Promise<void> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (invoice) {
      await this.invoiceRepo.remove(invoice);
    }
  }

  async deleteAllInvoices() {
    const invoices = await this.invoiceRepo.find();
    for (const invoice of invoices) {
      await this.invoiceRepo.remove(invoice);
    }
  }

  async deleteAllPdfs() {
    const invoices = await this.invoicePdfRepo.find();
    for (const invoice of invoices) {
      await this.invoicePdfRepo.remove(invoice);
    }
  }
}