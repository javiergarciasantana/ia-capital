// backend/src/ai-chat/user-facts.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../documents/document.entity';
import { Profit } from '../profits/profit.entity';

export type Facts = {
    documents: Array<{
        id: any;
        title: string;
        bank?: string;
        type?: string;
        dateISO?: string;  // fecha ISO preferida
        year?: number;
        month?: string | number;
    }>;
    latestDocument?: Facts['documents'][number];
    latestByBank: Record<string, Facts['documents'][number]>;
    generalDocuments: Array<Facts['documents'][number]>;
    profitsByBank: Record<string, { total: number; currency: string; last?: { amount: number; currency: string; dateISO?: string; label?: string } }>;
    lastProfit?: { bank?: string; amount: number; currency: string; dateISO?: string; label?: string };
};

@Injectable()
export class UserFactsService {
    constructor(
        @InjectRepository(Document) private readonly docRepo: Repository<Document>,
        @InjectRepository(Profit) private readonly profitRepo: Repository<Profit>,
    ) { }

    // -------- helpers robustos --------
    private asDateISO(obj: any): string | undefined {
        const m = obj?.month;
        const y = obj?.year;
        if (obj?.date instanceof Date) return obj.date.toISOString();
        if (typeof obj?.date === 'string' || typeof obj?.date === 'number') {
            const d = new Date(obj.date);
            if (!isNaN(+d)) return d.toISOString();
        }
        if (y && m) {
            const monthNum =
                typeof m === 'number'
                    ? m
                    : this.monthToNumber(String(m));
            if (y && monthNum) {
                const d = new Date(Number(y), monthNum - 1, 1);
                if (!isNaN(+d)) return d.toISOString();
            }
        }
        if (obj?.createdAt) {
            const d = new Date(obj.createdAt);
            if (!isNaN(+d)) return d.toISOString();
        }
        return undefined;
    }

    private monthToNumber(m: string): number | undefined {
        const s = m.toLowerCase();
        const map: Record<string, number> = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
            'julio': 7, 'agosto': 8, 'septiembre': 9, 'setiembre': 9, 'octubre': 10,
            'noviembre': 11, 'diciembre': 12, 'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        };
        return map[s] || undefined;
    }

    private titleOf(d: any) {
        return d?.title ?? d?.name ?? d?.filename ?? `Documento ${d?.id ?? ''}`;
    }

    private bankOf(d: any) {
        return d?.bank ?? d?.entity ?? d?.issuer ?? undefined;
    }

    private typeOf(d: any) {
        return d?.type ?? d?.category ?? d?.docType ?? undefined;
    }

    private byBestDateDesc(a: any, b: any) {
        const da = this.asDateISO(a);
        const db = this.asDateISO(b);
        const ta = da ? +new Date(da) : 0;
        const tb = db ? +new Date(db) : 0;
        return tb - ta;
    }

    // -------- datos --------
    private async loadUserDocs(userId: number) {
        const candidates: any[] = [];
        const wheresUser: Record<string, any>[] = [
            { userId },
            { clientId: userId },
            { assignedUserId: userId },
            { ownerId: userId },
        ];
        for (const w of wheresUser) {
            try {
                const rows = await this.docRepo.find({ where: w as any, take: 200 });
                candidates.push(...rows);
            } catch { }
        }
        const uniq = new Map<any, any>();
        for (const d of candidates) uniq.set(d.id ?? JSON.stringify(d), d);
        const docs = Array.from(uniq.values()).sort(this.byBestDateDesc.bind(this));
        return docs;
    }

    private async loadGeneralDocs() {
        const wheresGen: Record<string, any>[] = [
            { isGeneral: true },
            { userId: null },
            { clientId: null },
            { assignedUserId: null },
        ];
        for (const w of wheresGen) {
            try {
                const rows = await this.docRepo.find({ where: w as any, take: 50 });
                if (rows?.length) return rows.sort(this.byBestDateDesc.bind(this));
            } catch { }
        }
        return [] as any[];
    }

    private docToFact(d: any): Facts['documents'][number] {
        const dateISO = this.asDateISO(d);
        return {
            id: d?.id,
            title: this.titleOf(d),
            bank: this.bankOf(d),
            type: this.typeOf(d),
            dateISO,
            year: d?.year ?? undefined,
            month: d?.month ?? undefined,
        };
    }

    private async loadProfits(userId: number) {
        const wheres = [{ userId }, { clientId: userId }, { ownerId: userId }, { accountUserId: userId }];
        const rows: any[] = [];
        for (const w of wheres) {
            try {
                const r = await this.profitRepo.find({ where: w, take: 500 });
                if (r?.length) rows.push(...r);
            } catch { }
        }
        return rows;
    }

    private profitDateISO(p: any): string | undefined {
        if (p?.date) {
            const d = new Date(p.date);
            if (!isNaN(+d)) return d.toISOString();
        }
        if (p?.year && p?.month) {
            const m = typeof p.month === 'number' ? p.month : this.monthToNumber(String(p.month));
            if (m) {
                const d = new Date(Number(p.year), m - 1, 1);
                if (!isNaN(+d)) return d.toISOString();
            }
        }
        if (p?.createdAt) {
            const d = new Date(p.createdAt);
            if (!isNaN(+d)) return d.toISOString();
        }
        return undefined;
    }

    // -------- API público --------
    async buildFacts(userId: number): Promise<Facts> {
        const docsUser = await this.loadUserDocs(userId);
        const docsGeneral = await this.loadGeneralDocs();

        const docFacts = docsUser.slice(0, 30).map(d => this.docToFact(d));
        const genFacts = docsGeneral.slice(0, 10).map(d => this.docToFact(d));

        // Último por banco
        const latestByBank: Facts['latestByBank'] = {};
        for (const d of docsUser) {
            const bank = this.bankOf(d);
            if (!bank) continue;
            if (!latestByBank[bank]) latestByBank[bank] = this.docToFact(d);
        }

        // Profits
        const profits = await this.loadProfits(userId);
        const profitsByBank: Facts['profitsByBank'] = {};
        let lastProfit: Facts['lastProfit'] | undefined;

        for (const p of profits) {
            const bank = p?.bank ?? p?.entity ?? undefined;
            const currency = (p?.currency ?? 'EUR').toUpperCase();
            const amount = Number(p?.amount ?? 0);
            const dateISO = this.profitDateISO(p);
            if (!profitsByBank[bank || '—']) profitsByBank[bank || '—'] = { total: 0, currency };
            // Acumulamos por divisa homogénea (si cambian divisas, se sobreescribe a la última; para algo mejor, partir por divisa)
            profitsByBank[bank || '—'].total += isFinite(amount) ? amount : 0;
            profitsByBank[bank || '—'].currency = currency;
            // Último visto
            if (!lastProfit || (dateISO && lastProfit.dateISO && +new Date(dateISO) > +new Date(lastProfit.dateISO))) {
                lastProfit = { bank, amount, currency, dateISO, label: p?.label ?? p?.concept ?? undefined };
            }
        }

        return {
            documents: docFacts,
            latestDocument: docFacts[0],
            latestByBank,
            generalDocuments: genFacts,
            profitsByBank,
            lastProfit,
        };
    }

    factsToPromptText(f: Facts) {
        const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES') : '—');

        const docsLines = f.documents.map(d => `• ${fmtDate(d.dateISO)} — ${d.title}${d.bank ? ` (${d.bank})` : ''}${d.type ? ` [${d.type}]` : ''}`);
        const genLines = f.generalDocuments.map(d => `• ${fmtDate(d.dateISO)} — ${d.title}${d.bank ? ` (${d.bank})` : ''}${d.type ? ` [${d.type}]` : ''}`);

        const latestByBankLines = Object.entries(f.latestByBank).map(([bank, d]) => `• ${bank}: ${fmtDate(d?.dateISO)} — ${d?.title ?? '—'}`);

        const profitsLines = Object.entries(f.profitsByBank).map(([bank, s]) =>
            `• ${bank}: total aprox. ${s.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${s.currency}` +
            (f.lastProfit?.bank === bank && f.lastProfit?.dateISO ? ` (último ${fmtDate(f.lastProfit.dateISO)})` : '')
        );

        return [
            'HECHOS DISPONIBLES (no los cites literalmente, úsalos para responder):',
            f.latestDocument ? `Último documento: ${fmtDate(f.latestDocument.dateISO)} — ${f.latestDocument.title}${f.latestDocument.bank ? ` (${f.latestDocument.bank})` : ''}${f.latestDocument.type ? ` [${f.latestDocument.type}]` : ''}` : 'Sin documentos del usuario.',
            latestByBankLines.length ? `Último por banco:\n${latestByBankLines.join('\n')}` : '—',
            docsLines.length ? `Documentos recientes:\n${docsLines.join('\n')}` : '—',
            genLines.length ? `Documentos generales:\n${genLines.join('\n')}` : '—',
            profitsLines.length ? `Resumen de beneficios por banco:\n${profitsLines.join('\n')}` : 'Sin beneficios registrados.',
        ].join('\n');
    }
}
