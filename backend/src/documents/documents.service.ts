// backend/src/documents/documents.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './document.entity';
import { UsersService } from '../users/users.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../users/user.entity';
import { PrivateAiService } from '../private-ai/private-ai.service';
import { ProfitsService } from '../profits/profits.service';

type Viewer = { id: number; role: 'client' | 'admin' | 'superadmin' };

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly docRepo: Repository<Document>,
    private readonly usersService: UsersService,
    private readonly privateAi: PrivateAiService,
    private readonly profits: ProfitsService,
  ) { }

  private norm(v?: string | null): string | null {
    if (v === undefined || v === null) return null;
    const t = String(v).trim();
    return t.length ? t : null;
  }

  private parseDateOrNow(raw?: string): Date {
    if (!raw) return new Date();
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  async saveFile(file: Express.Multer.File, body: CreateDocumentDto) {
    let user: User | null = null;
    if (body.userId) {
      user = await this.usersService.findById(body.userId);
      if (!user) throw new Error('Usuario destino no encontrado');
    }

    const docData: Partial<Document> = {
      filename: file.filename,
      originalName: file.originalname,
      type: this.norm(body.type) || 'desconocido',
      date: this.parseDateOrNow(body.date as any),
      title: this.norm(body.title) || file.originalname,
      description: this.norm(body.description) ?? undefined,
      month: this.norm(body.month) ?? undefined,
      year: this.norm(body.year) ?? undefined,
      bank: this.norm(body.bank) ?? undefined,
      user: user ?? null,
    };

    const saved = await this.docRepo.save(this.docRepo.create(docData));

    // Documentos "generales" no se analizan
    if (!saved.user) {
      this.logger.log(`Doc ${saved.id} general → no se analizan profits.`);
      return saved;
    }

    try {
      const uploadPath = path.resolve(process.cwd(), 'uploads', file.filename);
      const extraction = await this.privateAi.extractFromPdfLocal(uploadPath, saved.id);

      // 👇 PASAR userId para sellar la propiedad del profit
      await this.profits.saveExtraction({
        documentId: saved.id,
        userId: saved.user?.id ?? null,
        data: Array.isArray(extraction.profits) ? extraction.profits : [],
        summary: extraction.summary,
        rawTextChars: extraction.rawTextChars,
        elapsedMs: extraction.elapsedMs,
      });

      this.logger.log(
        `Analizado doc ${saved.id} (user ${saved.user.id}) → profits guardados.`,
      );
    } catch (e: any) {
      this.logger.error(`PrivateAI error en doc ${saved.id}: ${e?.message || e}`);
    }

    return saved;
  }

  async update(id: number, data: Partial<CreateDocumentDto>) {
    const doc = await this.docRepo.findOne({ where: { id }, relations: ['user'] });
    if (!doc) throw new Error('Documento no encontrado');

    if (data.title !== undefined) {
      const v = this.norm(data.title);
      doc.title = v ?? doc.title;
    }
    if (data.description !== undefined) {
      const v = this.norm(data.description);
      if (v !== null) doc.description = v;
    }
    if (data.month !== undefined) {
      const v = this.norm(data.month);
      if (v !== null) doc.month = v;
    }
    if (data.year !== undefined) {
      const v = this.norm(data.year);
      if (v !== null) doc.year = v;
    }
    if (data.bank !== undefined) {
      const v = this.norm(data.bank);
      if (v !== null) doc.bank = v;
    }
    if (data.date) {
      doc.date = this.parseDateOrNow(data.date as any);
    }

    // Reasignación de propietario
    if (data.userId !== undefined) {
      if (data.userId === null) {
        doc.user = null;
      } else {
        const user = await this.usersService.findById(data.userId);
        if (!user) throw new Error('Usuario no encontrado');
        doc.user = user;
      }
    }

    const updated = await this.docRepo.save(doc);

    // 👇 Si cambió el dueño, sincroniza ownership en profits del documento
    await this.profits.updateOwnershipByDocument(updated.id, updated.user?.id ?? null);

    return updated;
  }

  async delete(id: number) {
    const doc = await this.docRepo.findOneBy({ id });
    if (!doc) throw new Error('Documento no encontrado');

    // 🧹 limpia profits asociados (por si el FK no tiene cascade)
    await this.profits.deleteByDocument(id);

    const filePath = path.resolve(process.cwd(), 'uploads', doc.filename);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      this.logger.warn(`No se pudo borrar el archivo físico de ${id}: ${filePath}`);
    }

    return this.docRepo.remove(doc);
  }

  async reprocess(id: number) {
    const doc = await this.docRepo.findOne({ where: { id }, relations: ['user'] });
    if (!doc) throw new Error('Documento no encontrado');

    if (!doc.user) {
      this.logger.log(`Doc ${doc.id} es general → no se analizan profits.`);
      return { ok: true, skipped: true };
    }

    const uploadPath = path.resolve(process.cwd(), 'uploads', doc.filename);
    const extraction = await this.privateAi.extractFromPdfLocal(uploadPath, doc.id);

    // 👇 PASAR userId también al reprocesar
    await this.profits.saveExtraction({
      documentId: doc.id,
      userId: doc.user?.id ?? null,
      data: Array.isArray(extraction.profits) ? extraction.profits : [],
      summary: extraction.summary,
      rawTextChars: extraction.rawTextChars,
      elapsedMs: extraction.elapsedMs,
    });

    return { ok: true };
  }

  async findAll(): Promise<Document[]> {
    return this.docRepo.find({ order: { date: 'DESC' } });
  }

  async findAllFor(viewer: Viewer): Promise<Document[]> {
    if (viewer.role === 'client') {
      return this.docRepo.find({
        where: [{ user: { id: viewer.id } as any }, { user: null as any }],
        order: { date: 'DESC' },
        relations: ['user'],
      });
    }
    return this.docRepo.find({
      order: { date: 'DESC' },
      relations: ['user'],
    });
  }
}
