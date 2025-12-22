// backend/src/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { Report } from './report.entity';
import { History } from './history.entity';
import { Distribution } from './distribution.entity';
import { ChildDistribution } from './child-distribution.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, History, Distribution, ChildDistribution]) // <-- Register entities here
  ],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}