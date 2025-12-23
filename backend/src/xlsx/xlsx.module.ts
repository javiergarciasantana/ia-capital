import { Module } from '@nestjs/common';
import { XlsxController } from './xlsx.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsModule } from '../reports/reports.module'; // <-- Import here
import { UsersModule } from 'src/users/users.module';



@Module({
  imports: [ReportsModule, UsersModule],
  controllers: [XlsxController],
})
export class XlsxModule {}