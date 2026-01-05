// pages/api/[...path].ts
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: { bodyParser: false, externalResolver: true },
};

const UPSTREAM =
  process.env.NEXT_API_PROXY_ORIGIN || 'http://ia-capital_web-iacapital:5000';

function readBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const parts = (req.query.path ?? []) as string[];
    const qs = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const url = `${UPSTREAM}/api/${parts.join('/')}${qs}`;

    // Copiamos headers filtrando los problemáticos
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      const key = k.toLowerCase();
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(key)) continue;
      headers.set(key, Array.isArray(v) ? v.join(',') : String(v));
    }

    const init: RequestInit = { method: req.method, headers };

    // Para métodos con body
    if (req.method && !['GET', 'HEAD'].includes(req.method.toUpperCase())) {
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('multipart/form-data') || ct.includes('octet-stream')) {
        // Para streams (subidas) usamos el propio req + duplex
        (init as any).duplex = 'half';
        (init as any).body = req as any;
      } else {
        // Para JSON/x-www-form-urlencoded leemos a Buffer
        const buf = await readBody(req);
        (init as any).body = buf;
        headers.set('content-length', String(buf.length));
      }
    }

    const upstream = await fetch(url, init);

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key === 'content-encoding' || key === 'transfer-encoding') return;
      res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err: any) {
    res.status(502).json({ message: 'Proxy error', detail: err?.message || String(err) });
  }
}
