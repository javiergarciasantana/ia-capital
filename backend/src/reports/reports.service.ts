// Example in your reports.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Report } from './report.entity';
import { ReportPdf } from './reportPdf.entity';
import { Distribution } from './distribution.entity';
import { ChildDistribution } from './child-distribution.entity';
import { UsersService } from 'src/users/users.service';

import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import * as PDFDocument from 'pdfkit';

import * as path from 'path';
import axios from 'axios';
import * as fs from 'fs';

const FormData = require('form-data'); // Usa esto

const GOTENBERG_URL = process.env.GOTENBERG_URL || 'http://gotenberg:3080';

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  
  constructor(
    @InjectRepository(Report) private reportRepo: Repository<Report>,
    @InjectRepository(ReportPdf) private reportPdfRepo: Repository<ReportPdf>,

    @InjectRepository(Distribution) private DistributionRepo: Repository<Distribution>,
    @InjectRepository(ChildDistribution) private ChildDistributionRepo: Repository<ChildDistribution>,
    private readonly usersService: UsersService,
    
  ) {}

  async saveReport(reportDto: any) {
    
    const existingReport = await this.reportRepo.findOne({ where: { fechaInforme: reportDto.fechaInforme }});
    
    if(existingReport) {
      // Remove the invoice reference from lastReport since it's a one-to-one relation
      this.logger.warn(`Informe ya generado`);      
      await this.deleteReport(existingReport.id);
    }

    const client = await this.usersService.findById(reportDto.clienteId);
    if (!client || !client.profile) {
      this.logger.warn(`Client ${reportDto.clienteId} not found or has no profile.`);
      return;
    }
    const report = this.reportRepo.create({
      clienteId: reportDto.clienteId,
      fechaInforme: reportDto.fechaInforme,
      resumenGlobal: reportDto.resumenGlobal,
      resumenTailored: reportDto.resumenTailored,
      resumenEjecutivo: reportDto.resumenEjecutivo,
      snapshot: reportDto.snapshot,
      client,
      distribution: Array.isArray(reportDto.distribucion)
      ? reportDto.distribucion.map((d: any) => this.DistributionRepo.create(d))
      : [],
      child_distribution: Array.isArray(reportDto.distribucion_hijos)
      ? reportDto.distribucion_hijos.map((d: any) => this.ChildDistributionRepo.create(d))
      : [],
    });
    const savedReport = await this.reportRepo.save(report);
    
    const pdfBuffer = await this.generateReportPdf(savedReport, client);
    
    const newPdf = this.reportPdfRepo.create({
      pdf: pdfBuffer, 
      clienteId: reportDto.clienteId,
      report: savedReport
    })
    
    const savedPdf = await this.reportPdfRepo.save(newPdf);  
    savedReport.reportPdf = savedPdf;  
    await this.updateReport(savedReport.id, savedReport);
    
    return { report: savedReport, pdf: pdfBuffer };
  }

  async mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
    const mergedPdf = await PDFLibDocument.create();
    for (const buffer of buffers) {
      const pdf = await PDFLibDocument.load(buffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }
    return Buffer.from(await mergedPdf.save());
  }

  async  generatePdfFromHtml(htmlString: string): Promise<Buffer> {
    try {
      const form = new FormData();

      // Gotenberg convierte el archivo virtual "index.html"
      form.append('files', Buffer.from(htmlString), 'index.html');

      // Opciones de formato (puedes tipar esto en una interfaz si varía mucho)
      form.append('marginTop', '0.4');
      form.append('marginBottom', '0.4');
      form.append('marginLeft', '0.4');
      form.append('marginRight', '0.4');
      form.append('paperWidth', '8.27');  // A4
      form.append('paperHeight', '11.7'); // A4

      // Petición a Gotenberg
      // Especificamos <Buffer> en AxiosResponse para que TS sepa qué devuelve .data
      const response = await axios.post(
        `${GOTENBERG_URL}/forms/chromium/convert/html`,
        form,
        {
          headers: {
            ...form.getHeaders(),
          },
          responseType: 'arraybuffer'
        }
      );

      return response.data as Buffer;

    } catch (error: unknown) {
      // FIX: Cast error to 'any' to bypass the "unknown" and "isAxiosError" checks
      const err = error as any;

      if (err.response) {
        console.error('Error de Gotenberg status:', err.response.status);
        if (err.response.data) {
            // Convert buffer to string to see the error message
            console.error('Detalle:', err.response.data.toString());
        }
      } else {
        console.error('Error inesperado:', err.message || err);
      }
      
      throw new Error('No se pudo generar el PDF');
    }
  }

  private async generateReportPdf(report: any, client: any): Promise<Buffer> {
    // --- COVER PAGE ---
      const coverPagePromise = new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ autoFirstPage: false });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.addPage();

      // Logo
      const logoPath = path.join(__dirname, '..', 'common', 'logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 40, { width: 120 });
      }

      // Title
      const fecha = new Date(report.fechaInforme);
      const mes = MONTHS_ES[fecha.getMonth()];
      const year = fecha.getFullYear();
      const nombre = client?.profile?.firstname || '';
      const apellido = client?.profile?.lastname || '';
      const fullName = `${nombre} ${apellido}`.trim();

      doc.fontSize(28)
        .fillColor('#0a1843ff')
        .text(`Análisis ${mes} ${year}`, { align: 'left' });

      doc.moveDown();
      doc.fontSize(22)
        .fillColor('#0a1843ff')
        .text(`${fullName}`, 200, 120, { align: 'left' });

      doc.end();
    });

    const [coverPageBuffer, resumenGlobalBuffer, resumenTailoredBuffer] = await Promise.all([
      coverPagePromise,
      this.generatePdfFromHtml(report.resumenGlobal),
      this.generatePdfFromHtml(report.resumenTailored),
    ]);

    return this.mergePdfBuffers([coverPageBuffer, resumenGlobalBuffer, resumenTailoredBuffer]);
  }

  async getReports() {
    const reports = await this.reportRepo.find({
      relations: ['distribution', 'child_distribution'],
      order: { fechaInforme: 'ASC' },
    });

    return reports;
  }

  async getReportsBetweenDates(from: Date, to: Date) {
    // const reports = await this.reportRepo.find({
    //   relations: ['history', 'distribution', 'child_distribution'],
    //   order: { fechaInforme: 'ASC' },
    // });

    // return reports;
    // Ensure 'from' and 'to' are Date objects
    let fromDate = from instanceof Date ? from : new Date(from);
    let toDate = to instanceof Date ? to : new Date(to);

    // Set to UTC start/end of day
    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);

    const reports = await this.reportRepo.find({
      where: {
        fechaInforme: Between(fromDate, toDate),
      },
      relations: ['distribution', 'child_distribution', 'client'],
      order: { fechaInforme: 'ASC' },
    });
    return reports;
  }

  async getReportPdfForUser(reportId: number): Promise<ReportPdf | null> {
    return await this.reportPdfRepo.findOne({
      where: { report: { id: reportId }},
    });
  }

  async getReportsForUser(id: Number) {
    const reports = await this.reportRepo.find({
      where: {
        clienteId: Number(id)
      },
      relations: ['distribution', 'child_distribution', 'invoice'],
      order: { fechaInforme: 'ASC' },
    });

    return reports;
  }

  async getReportsBetweenDatesForUser(from: Date, to: Date, id: Number) {
    let fromDate = from instanceof Date ? from : new Date(from);
    let toDate = to instanceof Date ? to : new Date(to);

    // Set to UTC start/end of day
    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);

    const reports = await this.reportRepo.find({
      where: {
        clienteId: Number(id),
        fechaInforme: Between(fromDate, toDate)
      },
      relations: ['distribution', 'child_distribution'],
      order: { fechaInforme: 'ASC' },
    });
    return reports;
  }

  async updateReport(reportId: number, reportDto: any) {
    const report = await this.reportRepo.findOne({
      where: { id: reportId },
      relations: ['distribution', 'child_distribution', 'reportPdf'],
    });

    if (!report) {
      throw new Error('Report not found');
    }
    console.log("fecha", reportDto.fechaInforme)

    // Update main report fields
    report.clienteId = reportDto.clienteId ?? report.clienteId;
    report.fechaInforme = reportDto.fechaInforme ?? report.fechaInforme;
    report.resumenGlobal = reportDto.resumenGlobal ?? report.resumenGlobal;
    report.resumenTailored = reportDto.resumenTailored ?? report.resumenTailored;
    report.resumenEjecutivo = reportDto.resumenEjecutivo ?? report.resumenEjecutivo;
    report.snapshot = reportDto.snapshot ?? report.snapshot;
    report.reportPdf = reportDto.reportPdf ?? report.reportPdf;

    // Optionally update distributions if provided
    if (Array.isArray(reportDto.distribucion)) {
      // Remove old distributions
      await this.DistributionRepo.delete({ report: { id: reportId } });
      // Add new distributions
      report.distribution = reportDto.distribucion.map((d: any) => this.DistributionRepo.create(d));
    }

    if (Array.isArray(reportDto.distribucion_hijos)) {
      // Remove old child distributions
      await this.ChildDistributionRepo.delete({ report: { id: reportId } });
      // Add new child distributions
      report.child_distribution = reportDto.distribucion_hijos.map((d: any) => this.ChildDistributionRepo.create(d));
    }

    return this.reportRepo.save(report);
  }

  async deleteReport(reportId: number) {
    // Find the report with its invoice and invoicePdf relations
    const report = await this.reportRepo.findOne({
      where: { id: reportId }
    });

    if (!report) {
      throw new Error('Report not found');
    }
    // Delete the report itself
    await this.reportRepo.remove(report);
  }

  async deleteAllReports() {
    const reports = await this.reportRepo.find();
    for (const report of reports) {
      await this.reportRepo.remove(report);
    }
  }
}