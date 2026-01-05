import Header from '../components/Header';
import { withAuth } from '../utils/withAuth';
import { useAuth } from '../context/AuthContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api'

type Role = 'system' | 'user' | 'assistant';
type Msg = { role: Role; content: string };

// --- STYLES & ANIMATIONS ---
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes jump {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
  .animate-message {
    animation: fadeIn 0.3s ease-out forwards;
  }
  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #aaa;
    margin: 0 2px;
    animation: jump 0.6s infinite;
  }
  .dot:nth-child(2) { animation-delay: 0.1s; }
  .dot:nth-child(3) { animation-delay: 0.2s; }
`;

// Helper component for the jumping dots
const ThinkingDots = () => (
  <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0 4px' }}>
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
  </div>
);

// Limpieza ligera durante el stream
function liveSanitize(s: string) {
  return s
    .replace(/\b(\w{3,})(\s+\1\b)+/gi, '$1')  // palabra repetida
    .replace(/([,.!?¿¡])\1+/g, '$1');         // signos duplicados
}

function ChatPage() {
  const { auth } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  // status: 'idle' | 'sending' (waiting for first byte) | 'streaming' (receiving text) | 'error'
  const [status, setStatus] = useState<'idle' | 'sending' | 'streaming' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth?.token || ''}`,
    }),
    [auth?.token]
  );

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Cargar histórico
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/ai/chat/history?limit=60`, { headers });
        const data = res.data;
        setMessages(data.messages || []);
        setTimeout(scrollToBottom, 100);
      } catch (e: any) {
        const errorMessage = e.response?.data?.message || e.message || 'No se pudo cargar el historial';
        console.warn(errorMessage);      }
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
    setStatus('sending'); // "Thinking" state

    const userMsg: Msg = { role: 'user', content };
    // Añadimos mensaje usuario y un placeholder vacío para el asistente
    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '' }]);
    setInput('');
    setTimeout(scrollToBottom, 0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${process.env.NEXT_API_PROXY_ORIGIN || 'http://localhost:5000/api'}/ai/chat`, {
        method: 'POST',
        headers: headers, // Your useMemo for headers is still perfect
        body: JSON.stringify({ messages: [userMsg] }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(await res.text() || `HTTP ${res.status}`);
      }

      setStatus('streaming'); // First byte received
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
      abortRef.current = null;
      setTimeout(scrollToBottom, 0);
    }
  };

  return (
      <div className="dashboard-container" style={{ 
        backgroundColor: '#f8fafc', 
        height: '100vh',        // Altura fija de ventana
        display: 'flex',        // Flex para organizar header y main
        flexDirection: 'column',
        overflow: 'hidden'      // Evita scroll en el body
      }}>
      <style>{styles}</style>
      <Header variant="dashboard" title="Chat" />
      
      <main className="chat-main" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        
        {/* MESSAGES AREA */}
        <div 
          className="chat-messages" 
          id="chatScroll" 
          ref={scrollRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px' 
          }}
        >
          {messages.map((m, i) => {
            const isUser = m.role === 'user';
            // If it's the last message (assistant) AND content is empty AND we are sending/streaming -> show dots
            const isThinking = !isUser && m.content === '' && (status === 'sending' || status === 'streaming');

            return (
              <div 
                key={i} 
                className={`animate-message`}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  backgroundColor: isUser ? '#2ecc71' : '#f1f1f1',
                  color: isUser ? '#fff' : '#333',
                  padding: '12px 18px',
                  borderRadius: isUser ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                  maxWidth: '75%',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  wordWrap: 'break-word',
                  fontSize: '15px',
                  lineHeight: '1.5'
                }}
              >
                {isThinking ? (
                  <ThinkingDots />
                ) : (
                  m.content
                )}
              </div>
            );
          })}
          
          {error && (
            <div className="message bot animate-message" style={{ alignSelf: 'center', background: '#ffebee', color: '#c62828', padding: '8px 16px', borderRadius: '8px' }}>
              ⚠️ {error}
            </div>
          )}
          <div style={{ height: 10 }} /> {/* Spacer */}
        </div>

        {/* INPUT AREA */}
        <div style={{ padding: '16px 20px', background: '#fff', borderTop: '1px solid #eee' }}>
          <form className="chat-input-container" onSubmit={send} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f9f9f9', padding: '8px', borderRadius: '30px', border: '1px solid #ddd' }}>
            <input
              className="chat-input"
              type="text"
              placeholder={status === 'streaming' || status === 'sending' ? 'NORA está escribiendo...' : 'Escribe un mensaje...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status === 'streaming' || status === 'sending'}
              style={{ flex: 1, border: 'none', background: 'transparent', padding: '10px 15px', outline: 'none', fontSize: '15px' }}
            />
            <button
              type="submit"
              className="send-btn"
              disabled={status === 'streaming' || status === 'sending' || input.trim().length === 0}
              style={{
                background: status === 'streaming' ? '#ccc' : '#2ecc71',
                color: '#fff',
                border: 'none',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                cursor: status === 'streaming' ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                transition: 'background 0.2s'
              }}
            >
              {status === 'streaming' || status === 'sending' ? <span style={{fontSize: '10px'}}>●</span> : '➤'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
             <button onClick={() => setMessages([])} style={{ background: 'none', border: 'none', color: '#999', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}>
               Borrar chat
             </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default withAuth(ChatPage, ['client', 'admin', 'superadmin']);