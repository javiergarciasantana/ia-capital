// src/pages/api/[...path].ts
import type { NextApiRequest, NextApiResponse } from 'next'

export const config = { api: { bodyParser: false, externalResolver: true } }

const BACKEND_ORIGIN =
  process.env.NEXT_API_PROXY_ORIGIN ||
  'https://ia-capital-web-iacapital.fn24pb.easypanel.host'

// normalizamos sin barra final
const ORIGIN = BACKEND_ORIGIN.replace(/\/$/, '')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Mantener /api en la url -> /api/... en backend
  const url = req.url || '/api'
  const target = ORIGIN + url

  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue
    headers.set(k, Array.isArray(v) ? v.join(',') : (v as string))
  }
  headers.delete('host')
  headers.delete('content-length')

  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const body = chunks.length ? Buffer.concat(chunks) : undefined

  const resp = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes((req.method || '').toUpperCase()) ? undefined : body,
  })

  res.status(resp.status)
  resp.headers.forEach((value, key) => {
    if (key === 'content-encoding' || key === 'transfer-encoding') return
    res.setHeader(key, value)
  })
  const buf = Buffer.from(await resp.arrayBuffer())
  res.end(buf)
}
