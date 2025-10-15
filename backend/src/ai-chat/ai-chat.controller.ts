import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';
import { ChatRequestDto } from './dto/chat.dto';
import { ValidationPipe } from '@nestjs/common';

@Controller('ai/chat')
@UseGuards(JwtAuthGuard)
export class AiChatController {
  private activeUsers = new Set<number>(); // evita streams concurrentes por usuario

  constructor(private readonly chatService: AiChatService) { }

  @Get('history')
  async history(@Req() req: any, @Query('limit') limitQ?: string) {
    const limit = Math.max(1, Math.min(60, parseInt(limitQ || '60', 10)));
    const user = req.user as { id: number; email: string; role: string };
    return this.chatService.getHistory(user.id, limit);
  }

  @Post('reset')
  async reset(@Req() req: any) {
    const user = req.user as { id: number };
    const out = await this.chatService.reset(user.id);
    return { ok: true, ...out };
  }

  @Post()
  async chat(@Req() req: Request & { user: any }, @Res() res: Response, @Body(new ValidationPipe({ whitelist: true })) body: ChatRequestDto) {
    const user = req.user as { id: number; email: string; role: string };

    // rate: 1 stream activo por usuario
    if (this.activeUsers.has(user.id)) {
      return res.status(429).json({ message: 'Ya tienes una respuesta en curso. Espera a que termine.' });
    }
    this.activeUsers.add(user.id);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const controller = new AbortController();
    const onClose = () => controller.abort();
    req.on('close', onClose);

    const write = (obj: any) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    const end = () => {
      res.end();
      req.off('close', onClose);
      this.activeUsers.delete(user.id);
    };

    try {
      for await (const ev of this.chatService.chatStream(
        user,
        body.messages,
        { temperature: body.temperature, maxTokens: body.max_tokens, signal: controller.signal },
      )) {
        write(ev);
      }
      end();
    } catch (err: any) {
      // Enviamos un evento normal con type:error para que el FE lo entienda
      write({ type: 'error', message: err?.message || 'Error interno' });
      end();
    }
  }
}
