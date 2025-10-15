import { Module } from '@nestjs/common';
import { PrivateAiService } from './private-ai.service';

@Module({
  providers: [PrivateAiService],
  exports: [PrivateAiService],
})
export class PrivateAiModule {}
