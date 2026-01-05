// backend/src/ai-chat/ai-chat.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { OllamaClient } from './ollama.client';
import { UserFactsService, Facts } from './user-facts.service'; // Added Facts type
import { UsersService } from 'src/users/users.service';

type Role = 'system' | 'user' | 'assistant';

@Injectable()
export class AiChatService {
  constructor(
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
    private readonly ollama: OllamaClient,
    private readonly factsService: UserFactsService, // Renamed for clarity
    private readonly usersService: UsersService,
  ) { }

  // Helper for formatting currency locally in the chat service
  private formatCurrency(val: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  }

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
        'Respeta el alcance del usuario autenticado.',
        'Nunca digas números de ID internos.'
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

  // ========= intent router (respuestas determinísticas usando el objeto Facts) =========
  private tryRouteIntent(question: string, facts: Facts) {
    const q = question.toLowerCase();
    const isAdmin = facts.role === 'admin';

    // 1) Consultas Financieras Rápidas (Patrimonio / AUM)
    if (/(patrimonio|dinero|aum|valor).*(total|actual|global)/i.test(q)) {
      if (isAdmin && facts.globalMetrics) {
        return { answer: `El AUM Total bajo gestión de la firma es de ${this.formatCurrency(facts.globalMetrics.totalAUM)}.` };
      }
      if (!isAdmin && facts.latestReport) {
        return { answer: `Según tu informe más reciente (${this.formatDate(facts.latestReport.fechaInforme)}), tu patrimonio total es de ${this.formatCurrency(facts.latestReport.kpis.totalPatrimony)}.` };
      }
    }

    // 2) Consultas de Deuda
    if (/(deuda|pasivo|debt).*(total|actual)/i.test(q)) {
      if (isAdmin && facts.globalMetrics) {
        return { answer: `La deuda total agregada de la firma es de ${this.formatCurrency(facts.globalMetrics.totalDebt)}.` };
      }
      if (!isAdmin && facts.latestReport) {
        return { answer: `Tu deuda registrada actual es de ${this.formatCurrency(facts.latestReport.kpis.debt)}.` };
      }
    }

    // 3) Consultas de Rendimiento / Retorno
    if (/(rendimiento|retorno|beneficio|ytd|rentabilidad)/i.test(q)) {
      if (isAdmin && facts.globalMetrics) {
        return { answer: `El rendimiento promedio YTD global de los clientes activos es del ${facts.globalMetrics.avgReturn}.` };
      }
      if (!isAdmin && facts.latestReport) {
        return { answer: `Tu rendimiento acumulado anual (YTD) es del ${facts.latestReport.kpis.ytdReturn}.` };
      }
    }

    // 4) Consultas de Facturas (Nuevo)
    if (/(factura|cobro|pago|invoice)/i.test(q)) {
        // Buscamos facturas en los reportes cargados
        const invoices = facts.reports.flatMap(r => r.invoices || []);
        if (invoices.length > 0) {
            const lastInv = invoices[0]; // Asumimos ordenados o tomamos el primero
            return { answer: `La última factura registrada es la #${lastInv.id} del ${lastInv.fechaFactura} por un importe de ${lastInv.importe}€.`};
        }
        return { answer: "No he encontrado facturas recientes en los informes disponibles." };
    }

    // 5) Consultas específicas por Banco (Logic preserved but using Data Structure)
    const mBank = q.match(/(banco|bank|entidad)\s+([a-záéíóúüñ .\-]+)/i);
    if (mBank) {
      const bankNameQuery = mBank[2].trim().toLowerCase(); 
      // Buscar en el último reporte disponible
      if (facts.latestReport?.kpis.bankBreakdown) {
         // bankBreakdown es array strings: ["Santander: 100€", "BBVA: 200€"]
         const match = facts.latestReport.kpis.bankBreakdown.find(b => b.toLowerCase().includes(bankNameQuery));
         if (match) {
             return { answer: `Según el último informe, tu posición en ${match}.` };
         }
      }
    }

    // 6) Último documento (general)
    if (/(ultimo|más reciente|mas reciente).*(documento|informe)/i.test(q)) {
      if (facts.latestReport) {
        return { answer: `El informe más reciente disponible es del ${this.formatDate(facts.latestReport.fechaInforme)}.` };
      }
    }

    return null; // Si no hay match directo, dejamos que Ollama genere la respuesta
  }

  // Helper date formatter
  private formatDate(iso: string) {
      return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ========= system + HECHOS =========
  private async buildSystemMessages(user: { id: number; email: string; role: string; name: string }) {
    const persona = this.buildPersona();
    
    // 1. Obtenemos la estructura rica de datos (Facts)
    const facts: Facts = await this.factsService.buildFacts({ id: user.id, role: user.role });
    
    // 2. Convertimos esa estructura a texto formateado para el contexto del LLM
    const factsText = this.factsService.factsToPromptText(facts);
    
    // 3. Obtenemos nombre de usuario directamente de los Facts (evitamos llamada extra a DB)
    const userLabel = facts.userProfile?.firstName || user.name || 'Usuario';

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
        content: `Usuario autenticado: ${userLabel} (Rol: ${user.role}).`,      
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

    // Devolvemos tanto el contexto para Ollama como el objeto Facts puro para el Router
    return { system, facts };
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

    // Construir contexto con HECHOS financieros enriquecidos y objeto estructurado
    const { system, facts } = await this.buildSystemMessages(user);

    // ---- ROUTER DE INTENCIONES (respuesta directa SIN LLM si aplica) ----
    // Ahora pasamos el objeto 'facts' completo, no solo el texto
    const routed = this.tryRouteIntent(lastUserMsg.content, facts);
    
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