// backend/src/history/history.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { History } from './history.entity';
import { HistoryService } from './history.service'
import { HistoryController } from './history.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([History]),
    UsersModule
  ],
  providers: [HistoryService],
  exports: [HistoryService],
  controllers: [HistoryController]
})
export class HistoryModule {}