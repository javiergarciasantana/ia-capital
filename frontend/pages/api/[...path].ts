// pages/api/[...path].ts
import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false,       // reenviamos el cuerpo tal cual
    externalResolver: true,
  },
}

const BACKEND_ORIGIN =
  process.env.NEXT_API_PROXY_ORIGIN ||
  'https://ia-capital-web-iacapital.fn24pb.easypanel.host'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // /api/users?role=client  ->  https://backend/api/users?role=client
  const url = req.url || '/api'
  const target = BACKEND_ORIGIN + url.replace(/^\/api/, '')

  // Clonamos headers (sin hop-by-hop)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue
    if (Array.isArray(v)) headers.set(k, v.join(','))
    else headers.set(k, v as string)
  }
  headers.delete('host')
  headers.delete('content-length')

  // Leemos el cuerpo crudo (para POST/PUT/PATCH)
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const body = chunks.length ? Buffer.concat(chunks) : undefined

  const resp = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes((req.method || '').toUpperCase()) ? undefined : body,
  })

  // Reenviamos status + headers + body
  res.status(resp.status)
  resp.headers.forEach((value, key) => {
    if (key === 'content-encoding' || key === 'transfer-encoding') return
    res.setHeader(key, value)
  })
  const buf = Buffer.from(await resp.arrayBuffer())
  res.end(buf)
}
