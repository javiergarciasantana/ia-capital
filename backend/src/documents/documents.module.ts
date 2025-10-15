import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { UsersModule } from '../users/users.module';
import { PrivateAiModule } from '../private-ai/private-ai.module';
import { ProfitsModule } from '../profits/profits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    UsersModule,
    PrivateAiModule,
    ProfitsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule { }
