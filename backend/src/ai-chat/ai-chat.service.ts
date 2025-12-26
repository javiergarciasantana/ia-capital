// backend/src/ai-chat/ai-chat.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { OllamaClient } from './ollama.client';
import { UserFactsService } from './user-facts.service';
import { UsersService } from 'src/users/users.service';

type Role = 'system' | 'user' | 'assistant';

@Injectable()
export class AiChatService {
  constructor(
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
    private readonly ollama: OllamaClient,
    private readonly facts: UserFactsService,
    private readonly usersService: UsersService,

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
  private tryRouteIntent(question: string, factsText: string) {
    const q = question.toLowerCase();

    // 1) Consultas Financieras Rápidas (Patrimonio / AUM)
    // Matches: "cuanto dinero hay", "patrimonio total", "total aum", "valor de la cartera"
    if (/(patrimonio|dinero|aum|valor).*(total|actual|global)/i.test(q)) {
      // Intento ADMIN: Busca "AUM Total" en el bloque de resumen global
      const globalLine = factsText.match(/AUM Total.*: ([\d.,€$ ]+)/i);
      if (globalLine) return { answer: `El AUM Total bajo gestión de la firma es de ${globalLine[1]}.` };

      // Intento CLIENTE: Busca "Patrimonio:" en el informe más reciente
      // El regex busca la línea que suele tener formato: "[Fecha] Patrimonio: X"
      const clientLine = factsText.match(/Patrimonio: ([\d.,€$ ]+)/i);
      if (clientLine) return { answer: `Según tu informe más reciente, tu patrimonio total es de ${clientLine[1]}.` };
    }

    // 2) Consultas de Deuda
    // Matches: "tengo deuda", "cuál es el pasivo", "debt"
    if (/(deuda|pasivo|debt).*(total|actual)/i.test(q)) {
      // Intento ADMIN
      const adminDebt = factsText.match(/Deuda Total.*: (-?[\d.,€$ ]+)/i);
      if (adminDebt) return { answer: `La deuda total agregada de la firma es de ${adminDebt[1]}.` };

      // Intento CLIENTE
      const clientDebt = factsText.match(/Deuda: (-?[\d.,€$ ]+)/i);
      if (clientDebt) return { answer: `Tu deuda registrada actual es de ${clientDebt[1]}.` };
    }

    // 3) Consultas de Rendimiento / Retorno
    // Matches: "como va la cartera", "rendimiento ytd", "beneficio anual"
    if (/(rendimiento|retorno|beneficio|ytd|rentabilidad)/i.test(q)) {
      // Intento ADMIN
      const adminYtd = factsText.match(/Rendimiento Promedio YTD: ([\d.,% \-]+)/i);
      if (adminYtd) return { answer: `El rendimiento promedio YTD global es del ${adminYtd[1]}.` };

      // Intento CLIENTE
      const clientYtd = factsText.match(/Retorno YTD: ([\d.,% \-]+)/i);
      if (clientYtd) return { answer: `Tu rendimiento acumulado anual (YTD) es del ${clientYtd[1]}.` };
    }

    // 4) Consultas específicas por Banco (Logic preserved from previous version but cleaned up)
    const mBank = q.match(/(banco|bank|entidad)\s+([a-záéíóúüñ .\-]+)/i);
    if (mBank) {
      const bankNameQuery = mBank[2].trim(); // ej: "Santander"
      // Buscamos en el texto si aparece "Santander: €XXXX" (formato nuevo de UserFactsService)
      // O buscamos en el resumen narrativo si se menciona.
      // Dado que UserFactsService ahora pone "Bancos: BBVA: €..., Santander: €..."
      const bankRegex = new RegExp(`${bankNameQuery}.*?([\\d.,€$]+)`, 'i');
      const bankMatch = factsText.match(bankRegex);
      
      if (bankMatch) {
         return { answer: `La posición registrada para ${bankNameQuery} es de ${bankMatch[1]}.` };
      }
    }

    // 5) Último documento (general)
    if (/(ultimo|más reciente|mas reciente).*(documento|informe)/i.test(q)) {
      // El UserFactsService pone primero el informe más reciente con fecha
      const firstReportLine = factsText.match(/\[(\d{1,2}\/\d{1,2}\/\d{4})\]/);
      if (firstReportLine) {
        return { answer: `El informe más reciente disponible es del ${firstReportLine[1]}.` };
      }
    }

    return null; // Si no hay match directo, dejamos que Ollama genere la respuesta
  }

  // ========= system + HECHOS =========
  private async buildSystemMessages(user: { id: number; email: string; role: string; name: string }) {
    const persona = this.buildPersona();
    // UserFactsService ahora devuelve una estructura rica (Facts)
    const f = await this.facts.buildFacts({ id: user.id, role: user.role });
    // Convertimos esa estructura a texto formateado para el prompt
    const factsText = this.facts.factsToPromptText(f);
    const fullUser = await this.usersService.findById(user.id);
    console.log("username", fullUser.profile?.firstName);
    const userLabel = fullUser.profile?.firstName 

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
        content: `Usuario autenticado: ${userLabel} (Rol: ${user.role}, Nombre: ${userLabel}).`,      },
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
    user: { id: number; email: string; role: string; name: string },
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

    // Guardar mensaje usuario
    await this.msgRepo.save(this.msgRepo.create({
      conversationId: conv.id,
      role: 'user',
      content: lastUserMsg.content.slice(0, 2000),
    }));

    // Construir contexto con HECHOS financieros enriquecidos
    const { system, factsText } = await this.buildSystemMessages(user);

    // ---- ROUTER DE INTENCIONES (respuesta directa SIN LLM si aplica) ----
    const routed = this.tryRouteIntent(lastUserMsg.content, factsText);
    if (routed?.answer) {
      const final = this.sanitize(routed.answer);
      yield { type: 'chunk', content: final };
      
      // Guardar respuesta del asistente (router)
      await this.msgRepo.save(this.msgRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content: final,
      }));
      
      yield { type: 'done', usage: { input: 0, output: final.length }, final };
      return;
    }

    // ---- LLM (Ollama) ----
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
        
        // Guardar respuesta del asistente (LLM)
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