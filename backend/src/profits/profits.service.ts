// backend/src/profits/profits.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profit } from './profit.entity';

type Viewer = { id: number; role: 'client' | 'admin' | 'superadmin' };

@Injectable()
export class ProfitsService {
    constructor(@InjectRepository(Profit) private repo: Repository<Profit>) { }

    async saveExtraction(payload: {
        documentId: number;
        userId: number | null;          // 👈 NUEVO
        data: any;
        summary?: string;
        rawTextChars?: number;
        elapsedMs?: number;
    }) {
        // evitar duplicados del mismo doc
        await this.repo.delete({ document: { id: payload.documentId } as any });

        const row = this.repo.create({
            document: { id: payload.documentId } as any,
            user: payload.userId ? ({ id: payload.userId } as any) : null, // 👈 set owner
            data: Array.isArray(payload.data) ? payload.data : [],
            summary: payload.summary ?? null,
            rawTextChars: payload.rawTextChars ?? null,
            elapsedMs: payload.elapsedMs ?? null,
        });
        return this.repo.save(row);
    }

    async updateOwnershipByDocument(documentId: number, userId: number | null) {
        await this.repo.update(
            { document: { id: documentId } as any },
            { user: userId ? ({ id: userId } as any) : null },
        );
    }

    async deleteByDocument(documentId: number) {
        await this.repo.delete({ document: { id: documentId } as any });
    }

    async findByDocument(documentId: number, viewer: Viewer) {
        const rows = await this.repo.query(
            `
      SELECT p.*
      FROM profit p
      WHERE p."documentId" = $1
      ORDER BY p."createdAt" DESC
      `,
            [documentId],
        );
        if (!rows.length) return [];
        if (viewer.role === 'client' && rows[0].userId !== viewer.id) return [];
        return rows;
    }

    // 👉 ahora filtramos por p."userId" (no por d."userId")
    async summaryByBank(viewer: Viewer, userId?: number, currency?: string) {
        const params: any[] = [];
        const whereParts: string[] = [];

        if (viewer.role === 'client') {
            whereParts.push('p."userId" = $1');
            params.push(viewer.id);
        } else if (userId) {
            whereParts.push('p."userId" = $1');
            params.push(userId);
        }
        if (currency && currency.toLowerCase() !== 'all') {
            whereParts.push(`UPPER(elem->>'currency') = $${params.length + 1}`);
            params.push(currency.toUpperCase());
        }
        const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

        return this.repo.query(
            `
      SELECT
        COALESCE(d.bank, 'Sin banco') AS key,
        CAST(COALESCE(SUM((elem->>'amount')::numeric), 0) AS double precision) AS total
      FROM profit p
      JOIN document d ON d.id = p."documentId"
      CROSS JOIN LATERAL jsonb_array_elements(p.data) AS elem
      ${where}
      GROUP BY COALESCE(d.bank, 'Sin banco')
      ORDER BY total DESC NULLS LAST
      `,
            params,
        );
    }

    async summaryByMonth(viewer: Viewer, userId?: number, currency?: string) {
        const params: any[] = [];
        const whereParts: string[] = [];

        if (viewer.role === 'client') {
            whereParts.push('p."userId" = $1');
            params.push(viewer.id);
        } else if (userId) {
            whereParts.push('p."userId" = $1');
            params.push(userId);
        }
        if (currency && currency.toLowerCase() !== 'all') {
            whereParts.push(`UPPER(elem->>'currency') = $${params.length + 1}`);
            params.push(currency.toUpperCase());
        }
        const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

        return this.repo.query(
            `
      SELECT
        d.month AS key,
        d.year,
        CAST(COALESCE(SUM((elem->>'amount')::numeric), 0) AS double precision) AS total
      FROM profit p
      JOIN document d ON d.id = p."documentId"
      CROSS JOIN LATERAL jsonb_array_elements(p.data) AS elem
      ${where}
      GROUP BY d.month, d.year
      ORDER BY d.year DESC NULLS LAST,
        CASE d.month
          WHEN 'Enero' THEN 1 WHEN 'Febrero' THEN 2 WHEN 'Marzo' THEN 3
          WHEN 'Abril' THEN 4  WHEN 'Mayo' THEN 5     WHEN 'Junio' THEN 6
          WHEN 'Julio' THEN 7  WHEN 'Agosto' THEN 8   WHEN 'Septiembre' THEN 9
          WHEN 'Octubre' THEN 10 WHEN 'Noviembre' THEN 11 WHEN 'Diciembre' THEN 12
          ELSE 999 END
      `,
            params,
        );
    }

    // (opcionales) clearAll / clearByUser / clearOrphans si los usas para mantenimiento...
}
