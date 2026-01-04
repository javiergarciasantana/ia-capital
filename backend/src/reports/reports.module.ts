// backend/src/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Report } from './report.entity';
import { Distribution } from './distribution.entity';
import { ChildDistribution } from './child-distribution.entity';
import { UsersModule } from '../users/users.module'
import { HistoryModule } from 'src/history/history.module';
import { ReportPdf } from './reportPdf.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, ReportPdf, Distribution, ChildDistribution]), // <-- Register entities here
    UsersModule,
    HistoryModule
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}