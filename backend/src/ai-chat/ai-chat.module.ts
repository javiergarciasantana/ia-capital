import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { OllamaClient } from './ollama.client';

// Nuevo agregador de “hechos”
import { UserFactsService } from './user-facts.service';
import { ReportsModule } from '../reports/reports.module';
import { UsersModule } from '../users/users.module';
import { InvoiceModule } from 'src/invoices/invoice.module';
import { HistoryModule } from 'src/history/history.module';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message]), ReportsModule, UsersModule, InvoiceModule, HistoryModule],
  controllers: [AiChatController],
  providers: [AiChatService, OllamaClient, UserFactsService],
  exports: [UserFactsService],

})
export class AiChatModule { }
