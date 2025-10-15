import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profit } from './profit.entity';
import { ProfitsService } from './profits.service';
import { ProfitsController } from './profits.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Profit])],
  providers: [ProfitsService],
  controllers: [ProfitsController],
  exports: [ProfitsService],
})
export class ProfitsModule {}
