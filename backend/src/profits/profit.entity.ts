// backend/src/profits/profit.entity.ts
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    RelationId,
} from 'typeorm';
import { Document } from '../documents/document.entity';
import { User } from '../users/user.entity';

@Entity({ name: 'profit' })
export class Profit {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Document, { onDelete: 'CASCADE', eager: true })
    @JoinColumn({ name: 'documentId' })
    document: Document;

    @RelationId((p: Profit) => p.document)
    documentId: number;

    // 👇 NUEVO: dueño del profit (denormalizado desde Document.user)
    @ManyToOne(() => User, { onDelete: 'SET NULL', eager: false, nullable: true })
    @JoinColumn({ name: 'userId' })
    user: User | null;

    @RelationId((p: Profit) => p.user)
    userId: number | null;

    @Column({ type: 'jsonb', nullable: false, default: () => "'[]'::jsonb" })
    data: any;

    @Column({ type: 'text', nullable: true })
    summary?: string | null;

    @Column({ type: 'int', nullable: true })
    rawTextChars?: number | null;

    @Column({ type: 'int', nullable: true })
    elapsedMs?: number | null;

    @CreateDateColumn()
    createdAt: Date;
}
