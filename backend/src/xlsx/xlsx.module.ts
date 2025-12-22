import { Module } from '@nestjs/common';
import { XlsxController } from './xlsx.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsModule } from '../reports/reports.module'; // <-- Import here



@Module({
    imports: [ReportsModule],

  controllers: [XlsxController],
})
export class XlsxModule {}