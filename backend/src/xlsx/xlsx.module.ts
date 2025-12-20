import { Module } from '@nestjs/common';
import { XlsxController } from './xlsx.controller';

@Module({
  controllers: [XlsxController],
})
export class XlsxModule {}