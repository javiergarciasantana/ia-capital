// backend/src/ai-chat/ai-chat.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { OllamaClient } from './ollama.client';
import { UserFactsService } from './user-facts.service';

type Role = 'system' | 'user' | 'assistant';

@Injectable()
export class AiChatService {
  constructor(
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
    private readonly ollama: OllamaClient,
    private readonly facts: UserFactsService,
  ) { }

  // ========= conversación =========
  async getOrCreateConversation(userId: number) {
    let conv = await this.convRepo.findOne({ where: { userId } });
    if (!conv) conv = await this.convRepo.save(this.convRepo.create({ userId }));
    return conv;
  }
  async getHistory(userId: number, limit = 60) {
    const conv = await this.getOrCreateConversation(userId);
    const msgs = await this.msgRepo.find({ where: { conversationId: conv.id }, order: { createdAt: 'ASC' } });
    return { conversationId: conv.id, messages: msgs.slice(-limit).map(m => ({ role: m.role as Role, content: m.content })) };
  }
  async reset(userId: number) {
    const conv = await this.getOrCreateConversation(userId);
    const deleted = await this.msgRepo.delete({ conversationId: conv.id });
    return { deleted: deleted.affected || 0 };
  }

  // ========= persona =========
  private buildPersona() {
    return {
      nombre: 'NORA',
      rol: 'Asistente virtual para la interpretación de datos económicos',
      tono: 'profesional, claro y conciso',
      normas: [
        'Responde SOLO en español.',
        'Sé breve: 1–3 frases; usa listas solo si aporta claridad.',
        'No inventes datos ni fechas: responde únicamente con los HECHOS proporcionados por el sistema. Si falta información, dilo explícitamente.',
        'No repitas palabras ni frases.',
        'Respeta el alcance del usuario autenticado y los documentos generales.',
      ],
    };
  }

  private sanitize(text: string) {
    let s = text;
    s = s.replace(/\b(\w{3,})(\s+\1\b)+/gi, '$1');                 // palabra repetida
    s = s.replace(/\b((?:\w+\s+){1,7}\w+)(?:\s+\1){1,}\b/gi, '$1'); // eco de frases cortas
    s = s.replace(/([,.!?¿¡])\1+/g, '$1');                          // signos duplicados
    s = s.replace(/[ \t]+/g, ' ');
    s = s.replace(/^(\w{3,})(\s+\1\b)/i, '$1');
    return s.trim();
  }

  // ========= intent router (respuestas determinísticas) =========
  private normalizeBank(s: string) {
    const out = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return out;
  }

  private tryRouteIntent(question: string, factsText: string) {
    // devolvemos {answer} si resolvemos sin LLM, si no null
    const q = question.toLowerCase();
    const reUltimoDoc = /(ultimo|más reciente|mas reciente).*(documento|informe)/i;
    const rePorBanco = /(banco|bank|entidad)\s+([A-Za-zÁÉÍÓÚÜÑ.\- ]{2,})/i;
    const reUltimoPorBanco = /(de\s+que\s+fecha|fecha).*(documento|informe).*(banco|bank|entidad)\s+([A-Za-zÁÉÍÓÚÜÑ.\- ]{2,})/i;
    const reProfits = /\b(beneficios|dividendos|rendimientos|profits|ingresos)\b.*\b(total|resumen|ultimo|último)?/i;

    // Extraemos de HECHOS lo que necesitamos (el texto está estructurado)
    const getLine = (starts: string) =>
      factsText.split('\n').find(l => l.toLowerCase().startsWith(starts.toLowerCase()));

    // 1) Último documento (general, no por banco)
    if (/(ultimo|más reciente|mas reciente).*(documento)/i.test(q)) {
      const line = getLine('Último documento:') || getLine('Ultimo documento:');
      if (line) {
        const answer = line.replace(/^Último documento:\s*/i, '').trim();
        return { answer: `El documento más reciente es: ${answer}.` };
      }
    }

    // 2) Último documento por banco
    const mBank = q.match(/(banco|bank|entidad)\s+([a-záéíóúüñ .\-]+)/i);
    if (mBank) {
      const bankQuery = this.normalizeBank(mBank[2]);
      // Buscar en bloque “Último por banco”
      const block = factsText.split('\n');
      const lines = block.filter(l => l.startsWith('• ') || l.startsWith('- '));
      const match = lines.find(l => this.normalizeBank(l).includes(bankQuery));
      if (match) {
        // "• JPMorgan: 01/09/2025 — Informe septiembre [mensual]"
        const cleaned = match.replace(/^•\s*/, '').trim();
        return { answer: `Último documento para ${mBank[2].trim()}: ${cleaned.split(':').slice(1).join(':').trim()}.` };
      }
    }

    // 3) Resumen de beneficios (profits)
    if (reProfits.test(q)) {
      const startIdx = factsText.indexOf('Resumen de beneficios por banco:');
      if (startIdx !== -1) {
        const sub = factsText.slice(startIdx).split('\n').slice(1, 6).join('\n').trim();
        if (sub) {
          const neat = sub.replace(/\n/g, ' · ').replace(/•\s*/g, '');
          return { answer: `Resumen de beneficios por banco: ${neat}.` };
        }
      }
    }

    return null;
  }

  // ========= system + HECHOS =========
  private async buildSystemMessages(user: { id: number; email: string }) {
    const persona = this.buildPersona();
    const f = await this.facts.buildFacts(user.id);
    const factsText = this.facts.factsToPromptText(f);

    const system: Array<{ role: Role; content: string }> = [
      {
        role: 'system',
        content: `${persona.nombre} — ${persona.rol}. Tono: ${persona.tono}.`,
      },
      {
        role: 'system',
        content: ['Normas:', ...persona.normas.map((n, i) => `${i + 1}. ${n}`)].join('\n'),
      },
      {
        role: 'system',
        content: `Usuario autenticado: ${user.email} (id:${user.id}).`,
      },
      {
        role: 'system',
        content: factsText,
      },
      {
        role: 'system',
        content: 'IMPORTANTE: Responde únicamente con base en los HECHOS anteriores. Si falta el dato, dilo sin inventar.',
      },
    ];

    return { system, factsText };
  }

  // ========= chat stream =========
  async *chatStream(
    user: { id: number; email: string },
    clientMessages: Array<{ role: Role; content: string }>,
    opts?: { temperature?: number; maxTokens?: number; signal?: AbortSignal },
  ) {
    const conv = await this.getOrCreateConversation(user.id);

    const past = await this.msgRepo.find({ where: { conversationId: conv.id }, order: { createdAt: 'ASC' } });
    const history = past.slice(-60).map(m => ({ role: m.role as Role, content: m.content }));

    const lastUserMsg = clientMessages[clientMessages.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== 'user' || !lastUserMsg.content?.trim()) {
      throw new Error('Mensaje de usuario vacío o inválido');
    }

    await this.msgRepo.save(this.msgRepo.create({
      conversationId: conv.id,
      role: 'user',
      content: lastUserMsg.content.slice(0, 2000),
    }));

    // Persona + HECHOS
    const { system, factsText } = await this.buildSystemMessages(user);

    // ---- ROUTER DE INTENCIONES (respuesta directa SIN LLM si aplica) ----
    const routed = this.tryRouteIntent(lastUserMsg.content, factsText);
    if (routed?.answer) {
      const final = this.sanitize(routed.answer);
      yield { type: 'chunk', content: final };
      await this.msgRepo.save(this.msgRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content: final,
      }));
      yield { type: 'done', usage: { input: 0, output: final.length }, final };
      return;
    }

    // ---- LLM (con HECHOS) ----
    const messages = [...system, ...history, ...clientMessages];
    let assistantText = '';

    for await (const chunk of this.ollama.chatStream(
      messages as any,
      { temperature: opts?.temperature, maxTokens: opts?.maxTokens, signal: opts?.signal },
    )) {
      if ((chunk as any).message?.content) {
        const piece = (chunk as any).message.content;
        assistantText += piece;
        yield { type: 'chunk', content: piece };
      } else if ((chunk as any).done) {
        const clean = this.sanitize(assistantText);
        const usage = {
          input: (chunk as any).prompt_eval_count ?? undefined,
          output: (chunk as any).eval_count ?? undefined,
          latency_ms: (chunk as any).total_duration ?? undefined,
        };
        await this.msgRepo.save(this.msgRepo.create({
          conversationId: conv.id,
          role: 'assistant',
          content: clean,
          tokensIn: usage.input,
          tokensOut: usage.output,
        }));
        yield { type: 'done', usage, final: clean };
      }
    }
  }
}
