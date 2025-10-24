// pages/api/[...path].ts
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,        // pasamos el body tal cual al backend
    externalResolver: true,
  },
};

// Usa el servicio interno del backend en la red de EasyPanel (no dominio público)
const UPSTREAM =
  process.env.NEXT_API_PROXY_ORIGIN || 'http://ia-capital_web-iacapital:5000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // reconstruimos la ruta y la query
    const parts = (req.query.path ?? []) as string[];
    const qs = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const url = `${UPSTREAM}/api/${parts.join('/')}${qs}`;

    // copiamos headers filtrando los problemáticos
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      const key = k.toLowerCase();
      if (['host', 'connection', 'content-length'].includes(key)) continue;
      if (Array.isArray(v)) headers.set(key, v.join(','));
      else headers.set(key, String(v));
    }

    // construimos la request hacia el backend
    const init: RequestInit = { method: req.method, headers };
    if (req.method && !['GET', 'HEAD'].includes(req.method.toUpperCase())) {
      // Node 18+ permite pasar el stream del req como body
      (init as any).body = req as any;
    }

    const upstream = await fetch(url, init);

    // status + headers (quitamos codificación para evitar doble compresión)
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
