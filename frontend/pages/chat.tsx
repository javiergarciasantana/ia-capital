import Header from '../components/Header';
import { withAuth } from '../utils/withAuth';
import { useAuth } from '../context/AuthContext';
import { useEffect, useMemo, useRef, useState } from 'react';

type Role = 'system' | 'user' | 'assistant';
type Msg = { role: Role; content: string };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api:5000';

// Limpieza ligera durante el stream (evita eco visual)
function liveSanitize(s: string) {
  return s
    .replace(/\b(\w{3,})(\s+\1\b)+/gi, '$1')  // palabra repetida
    .replace(/([,.!?¿¡])\1+/g, '$1');         // signos duplicados
}

function ChatPage() {
  const { auth } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'streaming' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth?.token || ''}`,
    }),
    [auth?.token]
  );

  const scrollToBottom = () => {
    const el = document.getElementById('chatScroll');
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Cargar histórico (≤60)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/ai/chat/history?limit=60`, { headers });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setMessages(data.messages || []);
        setTimeout(scrollToBottom, 0);
      } catch (e: any) {
        console.warn('No se pudo cargar historial', e?.message);
      }
    })();
  }, [headers]);

  // Parseo de SSE "data: {...}\n\n"
  async function readSSE(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onData: (obj: any) => void
  ) {
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 2);
        for (const line of raw.split('\n')) {
          const l = line.trim();
          if (!l.startsWith('data:')) continue;
          const json = l.slice(5).trim();
          if (!json) continue;
          try {
            onData(JSON.parse(json));
          } catch {
            /* ignorar línea parcial */
          }
        }
      }
    }
  }

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = input.trim();
    if (!content || status === 'streaming' || status === 'sending') return;

    setError(null);
    setStatus('sending');

    const userMsg: Msg = { role: 'user', content };

    // Añadimos usuario + placeholder assistant en UNA sola actualización
    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '' }]);
    setInput('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: [userMsg] }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }

      setStatus('streaming');
      const reader = res.body.getReader();

      await readSSE(reader, (evt) => {
        if (evt.type === 'chunk') {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant') {
              last.content = liveSanitize((last.content || '') + evt.content);
            }
            return copy;
          });
          scrollToBottom();
        } else if (evt.type === 'done') {
          // Reemplazamos el último mensaje por el texto limpio final
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant' && typeof evt.final === 'string') {
              last.content = evt.final;
            }
            return copy;
          });
          setStatus('idle');
          abortRef.current = null;
        } else if (evt.type === 'error') {
          setStatus('idle');
          setError(evt.message || 'Error interno');
          abortRef.current = null;
        }
      });
    } catch (err: any) {
      setStatus('idle');
      setError(err?.message || 'Error al conectar con la IA');
    } finally {
      // Si por cualquier motivo no llegó 'done', aseguramos salir del modo streaming
      abortRef.current = null;
      setTimeout(scrollToBottom, 0);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
  };

  const resetChat = async () => {
    try {
      await fetch(`${API_BASE}/ai/chat/reset`, { method: 'POST', headers });
      setMessages([]);
      setError(null);
      setStatus('idle');
    } catch {
      setError('No se pudo borrar el chat');
    }
  };

  return (
    <div className="chat-container">
      <Header variant="dashboard" title="Dashboard" />
      <main className="chat-main">
        <div className="chat-messages" id="chatScroll">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role === 'user' ? 'user' : 'bot'}`}>
              {m.content || (m.role === 'assistant' && status === 'streaming' ? 'Escribiendo…' : '')}
            </div>
          ))}
          {error && <div className="message bot">⚠️ {error}</div>}
        </div>

        <form className="chat-input-container" onSubmit={send}>
          <input
            className="chat-input"
            type="text"
            placeholder={status === 'streaming' ? 'Escribe mientras responde…' : 'Escribe un mensaje…'}
            aria-label="Escribe un mensaje"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            className="send-btn"
            aria-label="Enviar"
            disabled={status === 'streaming' || input.trim().length === 0}
          >
            ▶
          </button>
        </form>
      </main>
    </div>
  );
}

export default withAuth(ChatPage, ['client', 'admin', 'superadmin']);
