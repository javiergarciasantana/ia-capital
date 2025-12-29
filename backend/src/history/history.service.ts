// Example in your reports.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { History } from './history.entity';
import { LessThanOrEqual } from 'typeorm';



@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(History) private HistoryRepo: Repository<History>,
  ) {}

  async saveHistory(clienteId: number, historyDto: any) {
    console.log("History complete obj:", historyDto);
    
    const existingHistory = await this.HistoryRepo.find({
      where: { clienteId }
    });
    
    const existingKeys = new Set(
      existingHistory.map(h => h.fecha.toISOString())
    );

    const newHistoryEntries: History[] = historyDto
      .filter((entry: any) => {
        const entryDate = new Date(entry.fecha).toISOString();
        return !existingKeys.has(entryDate); // Keep only if not in existing
      })
      .map((entry: any) => this.HistoryRepo.create({
        clienteId,
        fecha: new Date(entry.fecha),
        valorNeto: entry.valorNeto,
        rendimientoMensual: entry.rendimientoMensual,
        rendimientoYTD: entry.rendimientoYTD // Note: typo in entity too
      }));
  
    if (newHistoryEntries.length > 0) {
      await this.HistoryRepo.save(newHistoryEntries);
      console.log(`Inserted ${newHistoryEntries.length} new history entries`);
    } else {
      console.log('No new history entries to insert');
    }
    
    return newHistoryEntries;
  }
    
  async getHistory() {
    const history = await this.HistoryRepo.find({
      order: { fecha: 'ASC' },
    });

    return history;
  }

  async getHistoryUpToDate(to: Date) {
    let toDate = to instanceof Date ? to : new Date(to);

    // Set to UTC end of day
    toDate.setUTCHours(23, 59, 59, 999);

    const history = await this.HistoryRepo.find({
      where: {
        fecha: LessThanOrEqual(toDate),
      },
      order: { fecha: 'ASC' },
    });
    return history;
  }

  async getHistoryForUser(id: Number) {
    const history = await this.HistoryRepo.find({
      where: {
        clienteId: Number(id)
      },
      order: { fecha: 'ASC' },
    });

    return history;
  }

  async getHistorUpToForUser(to: Date, id: Number) {
    let toDate = to instanceof Date ? to : new Date(to);

    // Set to UTC start/end of day
    toDate.setUTCHours(23, 59, 59, 999);

    console.log('Querying reports upto', toDate.toISOString());

    const history = await this.HistoryRepo.find({
      where: {
        clienteId: Number(id),
        fecha: LessThanOrEqual(toDate)
      },
      order: { fecha: 'ASC' },
    });
    return history;
  }

  async deleteHistory() {
    //Use delete({}) instead of clear() to avoid TRUNCATE and FK constraint errors
    const histories = await this.HistoryRepo.find();
    for (const history of histories) {
      await this.HistoryRepo.delete(history.id);
    }
  }
}

