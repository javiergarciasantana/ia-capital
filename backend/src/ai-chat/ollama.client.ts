import { Injectable } from '@nestjs/common';

type OllamaChunk =
  | { message?: { role: 'assistant' | 'user'; content: string }; done?: false }
  | { done: true; total_duration?: number; eval_count?: number; prompt_eval_count?: number };

@Injectable()
export class OllamaClient {
  private host = process.env.OLLAMA_HOST || '/api:11434';
  private model = 'llama3';


  /**
   * Fetches reports for the current context, depending on user role.
   * If admin, returns all reports. If client, returns only their reports.
   * @param user The user object (must have id and role)
   * @param usersService The UsersService instance
   * @param reportsService The ReportsService instance
   */
  static async getReportsForContext(
    user: { id: number; role: string },
    usersService: any,
    reportsService: any
  ) {
    const fullUser = await usersService.findById(user.id);
    if (!fullUser?.isActive) {
      throw new Error('Usuario no activo.');
    }
    if (fullUser.role === 'admin') {
      // Admin: get all reports
      return await reportsService.getReports();
    } else if (fullUser.role === 'client') {
      // Client: get only their reports
      return await reportsService.getReportsForUser(fullUser.id);
    } else {
      // Other roles: return empty or throw
      return [];
    }
  }
  
  async *chatStream(
    messages: Array<{ role: string; content: string }>,
    opts?: { temperature?: number; maxTokens?: number; signal?: AbortSignal },
  ) {
    console.log("Host: ", this.host);
    console.log("Model: ", this.model);

    const body = {
      model: this.model,
      stream: true,
      messages,
      options: {
        // 👉 Parámetros anti-repetición y de estabilidad
        temperature: Number(process.env.AI_TEMPERATURE ?? 0.15),
        top_k: Number(process.env.AI_TOP_K ?? 40),
        top_p: Number(process.env.AI_TOP_P ?? 0.9),
        repeat_penalty: Number(process.env.AI_REPEAT_PENALTY ?? 1.25),
        repeat_last_n: Number(process.env.AI_REPEAT_LAST_N ?? 256),
        // mirostat: Number(process.env.AI_MIROSTAT ?? 2),
        // mirostat_tau: Number(process.env.AI_MIROSTAT_TAU ?? 5.0),
        // mirostat_eta: Number(process.env.AI_MIROSTAT_ETA ?? 0.1),
        num_ctx: Number(process.env.AI_CONTEXT_TOKENS ?? 4096),
        num_predict: Number(process.env.AI_MAX_TOKENS ?? 256),
        stop: ['Usuario autenticado:', 'Contexto (', 'Normas:'],
      } as any,
    };

    if (typeof opts?.temperature === 'number') (body.options as any).temperature = opts.temperature;
    if (typeof opts?.maxTokens === 'number') (body.options as any).num_predict = opts.maxTokens;

    const res = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });

    if (!res.ok || !res.body) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try { yield JSON.parse(line) as any; } catch { /* línea incompleta */ }
      }
    }
    if (buf.trim().length) {
      try { yield JSON.parse(buf) as any; } catch { }
    }
  }
}
