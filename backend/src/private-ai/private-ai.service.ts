// backend/src/private-ai/private-ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ExtractionResult, ProfitItem } from './types';
import * as fs from 'fs';
import * as pdfParse from 'pdf-parse';

@Injectable()
export class PrivateAiService {
    private readonly logger = new Logger(PrivateAiService.name);

    async extractFromPdfLocal(filePath: string, documentId: number): Promise<ExtractionResult> {
        const t0 = Date.now();
        if (!fs.existsSync(filePath)) throw new Error('PDF no encontrado');

        const buffer = fs.readFileSync(filePath);
        const parsed = await pdfParse(buffer);

        // Normalización robusta
        const textRaw = String(parsed.text || '');
        const text = normalize(textRaw);
        const textAscii = toAscii(text);

        // --- Reglas principales ---
        let profits: ProfitItem[] = [
            ...this.extractReitBlock(textAscii),
            ...this.extractGenericDividends(textAscii),
        ];

        // Fallback SOLO si no hubo matches arriba
        if (profits.length === 0) {
            profits.push(...this.extractGlobalDividends(textAscii));
        }

        // Dedupe por (label, currency, amount, source) + dedupe numérico condicional
        profits = dedupeProfits(profits);

        const result: ExtractionResult = {
            documentId,
            summary: this.buildSummary(profits),
            profits,
            rawTextChars: text.length,
            elapsedMs: Date.now() - t0,
        };

        this.logger.log(`PrivateAI doc ${documentId}: items=${profits.length} (${result.elapsedMs}ms)`);
        return result;
    }

    // ---------- REGLAS ----------

    // Bloque tipo “RESULTADO DE LA INVERSION ... REIT”
    private extractReitBlock(textAscii: string): ProfitItem[] {
        const items: ProfitItem[] = [];
        const block = findBlock(textAscii, /RESULTADO\s+DE\s+LA\s+INVERSION.*REIT/i, 1500);
        if (!block) return items;

        const mDiv =
            block.match(/DIVIDENDOS?\s+COBRADOS?.*?:\s*([\d\.\,]+)\s*(EUR|USD|€|\$|US\$)/i) ||
            block.match(/DIVIDENDOS?.{0,40}?([\d\.\,]+)\s*(EUR|USD|€|\$|US\$)/i);

        if (mDiv) {
            items.push({
                label: 'Dividendos REIT',
                amount: parseMoney(mDiv[1]),
                currency: normCur(mDiv[2]),
                source: 'REIT USA',
                confidence: 0.9,
            });
        }
        return items;
    }

    // Secciones “En BBVA: … / En Sabadell: …”
    private extractGenericDividends(textAscii: string): ProfitItem[] {
        const items: ProfitItem[] = [];
        const sections = splitBySections(textAscii, /^En\s+([A-Za-z0-9 .&-]+):/m);

        for (const s of sections) {
            const bank = s.header?.trim();
            const body = s.body;

            const patterns = [
                /dividendos?.{0,60}?([\d\.\,]+)\s*(EUR|USD|€|\$|US\$)/gi,
                /rendimiento.{0,60}?(recibido|cobrado)?.{0,20}?([\d\.\,]+)\s*(EUR|USD|€|\$|US\$)/gi,
            ];

            for (const re of patterns) {
                let m: RegExpExecArray | null;
                while ((m = re.exec(body))) {
                    const idx = m.index ?? 0;

                    // Ventana local alrededor del match (para contexto)
                    const window = body.slice(Math.max(0, idx - 60), Math.min(body.length, idx + 140));

                    // ❌ Si huele a REIT en esta zona, NO lo contamos aquí (ya lo cuenta la regla REIT)
                    if (hasReitCue(window)) continue;

                    // ❌ Si huele a compra/transferencia cerca, ignoramos
                    if (hasInvestmentCue(window)) continue;

                    const rawAmount = m[1] || m[2];
                    const rawCur = m[2] || m[3];
                    const amount = parseMoney(rawAmount);
                    if (!amount) continue;

                    items.push({
                        label: 'Dividendos',
                        amount,
                        currency: normCur(rawCur),
                        source: bank || undefined,
                        confidence: 0.75,
                    });
                }
            }
        }
        return items;
    }

    // Fallback global: solo si no hubo matches arriba
    private extractGlobalDividends(textAscii: string): ProfitItem[] {
        const items: ProfitItem[] = [];
        const re = /DIVIDENDOS?.{0,80}?([\d\.\,]+)\s*(EUR|USD|€|\$|US\$)/gi;
        for (const m of textAscii.matchAll(re)) {
            const amount = parseMoney(m[1]);
            if (!amount) continue;
            items.push({
                label: 'Dividendos',
                amount,
                currency: normCur(m[2]),
                confidence: 0.6,
            });
        }
        return items;
    }

    private buildSummary(items: ProfitItem[]): string {
        if (!items.length) return 'No se detectaron beneficios.';
        const byCur = items.reduce((acc, it) => {
            acc[it.currency] = (acc[it.currency] || 0) + (it.amount || 0);
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(byCur)
            .map(([cur, total]) => `Total aprox.: ${formatEs(total)} ${cur}`)
            .join(' · ');
    }
}

// ---------- HELPERS ----------

function normalize(s: string) {
    return s
        .replace(/\u00A0/g, ' ') // NBSP
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

function toAscii(s: string) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quita tildes
}

function parseMoney(raw: string) {
    const r = String(raw).trim();
    let clean = r;
    if (r.includes('.') && r.includes(',')) {
        clean = r.lastIndexOf('.') > r.lastIndexOf(',')
            ? r.replace(/,/g, '')                      // 1,234.56 -> 1234.56
            : r.replace(/\./g, '').replace(',', '.');  // 1.234,56 -> 1234.56
    } else {
        clean = r.replace(/\./g, '').replace(',', '.'); // 1234,56 -> 1234.56  | 1234.56 -> 1234.56
    }
    const n = Number(clean.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
}

function normCur(c: string) {
    const u = (c || '').toUpperCase().trim();
    if (u === '€') return 'EUR';
    if (u === '$' || u === 'US$') return 'USD';
    return u;
}

function formatEs(n: number) {
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2 });
}

function findBlock(text: string, startRe: RegExp, len = 1200) {
    const m = text.match(startRe);
    if (!m) return '';
    const idx = m.index ?? 0;
    return text.slice(idx, idx + len);
}

function splitBySections(text: string, headerRe: RegExp) {
    const parts: Array<{ header?: string; body: string }> = [];
    const re = new RegExp(headerRe, 'gm');
    const headers: Array<{ start: number; name: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) headers.push({ start: match.index!, name: match[1] });
    if (!headers.length) return [{ body: text }];

    for (let i = 0; i < headers.length; i++) {
        const start = headers[i].start;
        const end = i + 1 < headers.length ? headers[i + 1].start : text.length;
        const headerLine = text.slice(start, text.indexOf('\n', start));
        const body = text.slice(headerLine.length + start, end);
        parts.push({ header: headers[i].name, body });
    }
    return parts;
}

function hasInvestmentCue(s: string) {
    // ⚠️ No incluimos “inversión” para no filtrar dividendos reales
    return /\b(suscrib|transferenc|ingres|traspas|aportar|apertura|compra|venta|fondeo|deposito)\w*/i.test(s);
}

function hasReitCue(s: string) {
    // Texto normalizado sin tildes. Caza 'REIT' o el encabezado del bloque.
    return /\bREIT\b|RESULTADO\s+DE\s+LA\s+INVERSION/i.test(s);
}

// DEDUPE estricto + numérico condicional
function dedupeProfits(items: ProfitItem[]) {
    const seen = new Set<string>();                // dedupe estricto por label|cur|amt|source
    const seenNumeric = new Map<string, ProfitItem>(); // cur|amt -> primer item visto
    const out: ProfitItem[] = [];

    for (const it of items) {
        const amtCents = Math.round((it.amount || 0) * 100);
        const cur = (it.currency || '').toUpperCase();
        const lbl = (it.label || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const src = (it.source || '').toLowerCase().trim();

        const strictKey = `${lbl}|${cur}|${amtCents}|${src}`;
        if (seen.has(strictKey)) continue; // duplicado exacto → fuera

        // Dedupe numérico CONDICIONAL:
        // si ya vimos el mismo cur+amount y el nuevo es 'reit' o sin source, probablemente es el mismo evento → fuera
        const numKey = `${cur}|${amtCents}`;
        const prev = seenNumeric.get(numKey);
        const isReit = /\breit\b/i.test(lbl);
        const hasNoSource = src.length === 0;

        if (prev && (isReit || hasNoSource)) {
            // descartamos este porque ya hubo otro con mismo importe+moneda
            continue;
        }

        seen.add(strictKey);
        if (!prev) seenNumeric.set(numKey, it);
        out.push(it);
    }
    return out;
}
