// Example in your reports.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Report } from './report.entity';
import { History } from './history.entity';
import { Distribution } from './distribution.entity';
import { ChildDistribution } from './child-distribution.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private reportRepo: Repository<Report>,
    @InjectRepository(History) private HistoryRepo: Repository<History>,
    @InjectRepository(Distribution) private DistributionRepo: Repository<Distribution>,
    @InjectRepository(ChildDistribution) private ChildDistributionRepo: Repository<ChildDistribution>,
  ) {}

  async saveReport(reportDto: any) {
    console.log("History complete obj:", reportDto.historico)
    const report = this.reportRepo.create({
      clienteId: reportDto.clienteId,
      fechaInforme: reportDto.fechaInforme,
      resumenEjecutivo: reportDto.resumenEjecutivo,
      snapshot: reportDto.snapshot,
      history: Array.isArray(reportDto.historico)
      ? reportDto.historico.slice().reverse().map((h: any) => this.HistoryRepo.create(h))
      : [],
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
      relations: ['history', 'distribution', 'child_distribution'],
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

    console.log('Querying reports from', fromDate.toISOString(), 'to', toDate.toISOString());

    const reports = await this.reportRepo.find({
      where: {
        fechaInforme: Between(fromDate, toDate),
      },
      relations: ['history', 'distribution', 'child_distribution'],
      order: { fechaInforme: 'ASC' },
    });
    return reports;
  }

  async getReportsForUser(id: Number) {
    const reports = await this.reportRepo.find({
      where: {
        clienteId: Number(id)
      },
      relations: ['history', 'distribution', 'child_distribution'],
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

    console.log('Querying reports from', fromDate.toISOString(), 'to', toDate.toISOString());

    const reports = await this.reportRepo.find({
      where: {
        clienteId: Number(id),
        fechaInforme: Between(fromDate, toDate)
      },
      relations: ['history', 'distribution', 'child_distribution'],
      order: { fechaInforme: 'ASC' },
    });
    return reports;
  }

  async deleteAllReports() {
    // Use delete({}) instead of clear() to avoid TRUNCATE and FK constraint errors
    const histories = await this.HistoryRepo.find();
    for (const history of histories) {
      await this.HistoryRepo.delete(history.id);
    }

    const distributions = await this.DistributionRepo.find();
    for (const distribution of distributions) {
      await this.DistributionRepo.delete(distribution.id);
    }

    const childDistributions = await this.ChildDistributionRepo.find();
    for (const childDistribution of childDistributions) {
      await this.ChildDistributionRepo.delete(childDistribution.id);
    }

    const reports = await this.reportRepo.find();
    for (const report of reports) {
      await this.reportRepo.delete(report.id);
    }
  }
}