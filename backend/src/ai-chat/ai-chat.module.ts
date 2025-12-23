import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { OllamaClient } from './ollama.client';

// Entidades reales del dominio
import { Document } from '../documents/document.entity';
import { Profit } from '../profits/profit.entity';

// Nuevo agregador de “hechos”
import { UserFactsService } from './user-facts.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, Document, Profit]), ReportsModule],
  controllers: [AiChatController],
  providers: [AiChatService, OllamaClient, UserFactsService],
  exports: [UserFactsService],

})
export class AiChatModule { }
