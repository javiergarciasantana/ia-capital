// backend/src/invoices/invoice.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';


import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { UsersModule } from '../users/users.module'
import { UsersService } from 'src/users/users.service';
import { ReportsService } from 'src/reports/reports.service';
import { ReportsModule } from 'src/reports/reports.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice]), 
    UsersModule, ReportsModule
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}