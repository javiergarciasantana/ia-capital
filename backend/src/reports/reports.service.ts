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

  async  generatePdfFromHtml(htmlString: string, footerHtml?: string): Promise<Buffer> {
    try {
      const form = new FormData();
      console.log('Goteberg URL', GOTENBERG_URL);
      // Gotenberg convierte el archivo virtual "index.html"
      form.append('files', Buffer.from(htmlString), 'index.html');
      if (footerHtml) {
        form.append('files', Buffer.from(footerHtml), 'footer.html');
      }
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

  private generateChartPageHtml(title: string, data: any[]): string {
    const labels = data.map(d => d.categoria);
    const values = data.map(d => d.porcentaje);

    // Chart.js colors
    const backgroundColors = [
      '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8',
      '#82ca9d', '#a4de6c', '#d0ed57', '#a4c8e0', '#1a2340'
    ];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap');
          body {
            font-family: 'Poppins', sans-serif;
            color: #333;
            font-size: 11px;
          }
          h1 {
            color: #0a1843;
            font-weight: 700;
            text-align: center;
          }
          .chart-container {
            width: 80%;
            max-width: 600px;
            margin: 40px auto;
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="chart-container">
          <canvas id="myPieChart"></canvas>
        </div>
        <script>
          const ctx = document.getElementById('myPieChart').getContext('2d');
          new Chart(ctx, {
            type: 'pie',
            data: {
              labels: ${JSON.stringify(labels)},
              datasets: [{
                label: 'Distribución',
                data: ${JSON.stringify(values)},
                backgroundColor: ${JSON.stringify(backgroundColors)},
                borderColor: '#fff',
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: {
                  position: 'top',
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      let label = context.label || '';
                      if (label) {
                        label += ': ';
                      }
                      if (context.parsed !== null) {
                        label += context.parsed.toFixed(2) + '%';
                      }
                      return label;
                    }
                  }
                }
              },
              animation: {
                duration: 0 // Disable animations to ensure chart is fully rendered
              }
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  private async generateReportPdf(report: any, client: any): Promise<Buffer> {
    // --- DYNAMIC DATA ---
    const fecha = new Date(report.fechaInforme);
    const mes = MONTHS_ES[fecha.getMonth()];
    const year = fecha.getFullYear();
    const nombre = client?.profile?.firstname || '';
    const apellido = client?.profile?.lastname || '';
    const fullName = `${nombre} ${apellido}`.trim();

    // --- LOGO TO BASE64 ---
    const logoPath = path.join(__dirname, '..', 'common', 'logo-light.png');
    let logoBase64 = '';
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    const footerHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Poppins', sans-serif;
            font-size: 9px;
            color: #999; /* Dimmed the text color */
            width: 100%;
            margin: 0 20px;
            text-align: center; /* Center all text by default */
          }
          .footer-container {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .line {
            width: 90%;
            height: 1px;
            margin-bottom: 8px;
            /* Fading gold line using a gradient background */
            background: linear-gradient(to right, transparent, #bfa14a 50%, transparent);
          }
          .contact-info {
            margin-bottom: 4px;
          }
          .contact-info span {
            margin: 0 10px; /* Add space between email and phone */
          }
          .motto {
            font-weight: 700;
            color: #0a1843;
            letter-spacing: 0.5px;
            opacity: 0.8; /* Slightly dim the motto as well */
          }
          .page-number {
            position: absolute;
            right: 0;
            color: #aaa;
          }
        </style>
      </head>
      <body>
        <div class="footer-container">
          <div class="line"></div>
          <div class="contact-info">
            <span>email: info@iacapital.ch</span>
            <span>tel: +41 799223329</span>
          </div>
          <div class="motto">
            TU CONFIANZA ES NUESTRA RESPONSABILIDAD
          </div>
        </div>
      </body>
      </html>
    `;
    // --- COVER PAGE HTML ---
    const coverPageHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;700&display=swap');
          body {
            font-family: 'Poppins', sans-serif;
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            background-color: #f4f7fa;
          }
          .cover-container {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 40px;
            background-color: #0a1843;
            color: white;
          }
          .logo {
            position: absolute;
            top: 40px;
            left: 40px;
            width: 150px;
          }
          h1 {
            font-size: 48px;
            font-weight: 700;
            margin: 0;
          }
          h2 {
            font-size: 32px;
            font-weight: 300;
            margin: 10px 0 0 0;
            color: #e0e0e0;
          }
          .footer {
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #555;
          }
        </style>
      </head>
      <body>
        ${logoBase64 ? `<img src="${logoBase64}" class="logo">` : ''}
        <div class="cover-container">
          <h1>Análisis de Cartera</h1>
          <h2>${fullName}</h2>
        </div>
        <div class="footer">
          ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${year}
        </div>
      </body>
      </html>
    `;

    const contentPageStyles = `
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap');
      body {
        font-family: 'Poppins', sans-serif;
        color: #333; /* Dark grey for text */
        font-size: 11px;
        line-height: 1.6; /* Improves readability */
      }
      h1, h2, h3, h4 {
        color: #0a1843; /* Main blue for headings */
        font-weight: 700;
      }
      p {
        /* This adds the "sangria" (indentation) to the first line of each paragraph */
        text-indent: 2em; 
        
        /* Optional: Justifies the text for a cleaner, block-like appearance */
        text-align: justify; 
        
        /* Optional: Ensures paragraphs don't start right at the top of a new page if possible */
        page-break-inside: avoid; 
      }
    `;

    // --- WRAP HTML CONTENT WITH STYLES ---
    const styledResumenGlobalHtml = `
      <!DOCTYPE html>
      <html><head><style>${contentPageStyles}</style></head>
      <body>${report.resumenGlobal}</body></html>
    `;

    const styledResumenTailoredHtml = `
      <!DOCTYPE html>
      <html><head><style>${contentPageStyles}</style></head>
      <body>${report.resumenTailored}</body></html>
    `;
    let childDistributionChartHtml = '';
    if (report.child_distribution && report.child_distribution.length > 0) {
      childDistributionChartHtml = this.generateChartPageHtml(
        'Distribución de Activos (Hijos)',
        report.child_distribution
      );
    }

    const distributionChartHtml = this.generateChartPageHtml(
      'Distribución de Activos',
      report.distribution
    );

    // --- GENERATE ALL PDF PARTS IN PARALLEL ---
    const pdfPromises = [
      this.generatePdfFromHtml(coverPageHtml),
      this.generatePdfFromHtml(distributionChartHtml, footerHtml),
      this.generatePdfFromHtml(styledResumenGlobalHtml, footerHtml),
      this.generatePdfFromHtml(styledResumenTailoredHtml, footerHtml),
    ];

    if (childDistributionChartHtml) {
      pdfPromises.splice(2, 0, this.generatePdfFromHtml(childDistributionChartHtml));
    }

    const pdfBuffers = await Promise.all(pdfPromises);

    // --- MERGE AND RETURN ---
    return this.mergePdfBuffers(pdfBuffers);
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