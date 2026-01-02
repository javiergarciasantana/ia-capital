// Example in your reports.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Report } from './report.entity';
import { Distribution } from './distribution.entity';
import { ChildDistribution } from './child-distribution.entity';
import { UsersService } from 'src/users/users.service';


@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  
  constructor(
    @InjectRepository(Report) private reportRepo: Repository<Report>,
    @InjectRepository(Distribution) private DistributionRepo: Repository<Distribution>,
    @InjectRepository(ChildDistribution) private ChildDistributionRepo: Repository<ChildDistribution>,
    private readonly usersService: UsersService,
    
  ) {}

  async saveReport(reportDto: any) {
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
    return this.reportRepo.save(report);
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
      relations: ['distribution', 'child_distribution'],
    });

    if (!report) {
      throw new Error('Report not found');
    }

    // Update main report fields
    report.clienteId = reportDto.clienteId ?? report.clienteId;
    report.fechaInforme = reportDto.fechaInforme ?? report.fechaInforme;
    report.resumenGlobal = reportDto.resumenGlobal ?? report.resumenGlobal;
    report.resumenTailored = reportDto.resumenTailored ?? report.resumenTailored;
    report.resumenEjecutivo = reportDto.resumenEjecutivo ?? report.resumenEjecutivo;
    report.snapshot = reportDto.snapshot ?? report.snapshot;

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