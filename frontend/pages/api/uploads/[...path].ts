// pages/api/uploads/[...path].ts
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: { bodyParser: false, externalResolver: true },
};

const UPSTREAM =
  process.env.NEXT_API_PROXY_ORIGIN || 'http://ia-capital_web-iacapital:5000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const parts = (req.query.path ?? []) as string[];
    const qs = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const url = `${UPSTREAM}/uploads/${parts.join('/')}${qs}`;

    // reenviamos headers útiles (por ej. Range)
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      const key = k.toLowerCase();
      if (['host','connection','content-length'].includes(key)) continue;
      if (Array.isArray(v)) headers.set(key, v.join(','));
      else headers.set(key, String(v));
    }

    const upstream = await fetch(url, { method: req.method, headers });
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key === 'content-encoding' || key === 'transfer-encoding') return;
      res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (e: any) {
    res.status(502).json({ message: 'Proxy error', detail: e?.message || String(e) });
  }
}
