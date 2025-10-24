import type { NextApiRequest, NextApiResponse } from 'next';

export const config = { api: { bodyParser: false, externalResolver: true } };

const UPSTREAM = process.env.NEXT_API_PROXY_ORIGIN || 'http://ia-capital_web-iacapital:5000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const parts = (req.query.path ?? []) as string[];
  const qs = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const url = `${UPSTREAM}/uploads/${parts.join('/')}${qs}`;

  const upstream = await fetch(url, { method: req.method });
  res.status(upstream.status);
  upstream.headers.forEach((v, k) => {
    if (k === 'content-encoding' || k === 'transfer-encoding') return;
    res.setHeader(k, v);
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}
