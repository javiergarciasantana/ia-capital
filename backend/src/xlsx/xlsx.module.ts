import { Module } from '@nestjs/common';
import { XlsxController } from './xlsx.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsModule } from '../reports/reports.module'; // <-- Import here
import { HistoryModule } from '../history/history.module';



@Module({
  imports: [ReportsModule, HistoryModule],
  controllers: [XlsxController],
})
export class XlsxModule {}