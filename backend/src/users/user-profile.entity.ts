import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn
} from 'typeorm';
import { User } from './user.entity';

export type KycStatus = 'pending' | 'approved' | 'rejected';

@Entity()
export class UserProfile {
    @PrimaryGeneratedColumn()
    id: number;

    // Identificación / PII
    @Column({ nullable: false }) firstName?: string;
    @Column({ nullable: true }) lastName?: string;
    @Column({ nullable: true }) phone?: string;
    @Column({ nullable: true }) country?: string;
    @Column({ nullable: true }) city?: string;
    @Column({ nullable: true }) address?: string;
    @Column({ nullable: true }) postalCode?: string;
    @Column({ nullable: true }) documentId?: string; // DNI/NIF
    @Column({ type: 'date', nullable: true }) birthDate?: string; // YYYY-MM-DD

    // Preferencias
    @Column({ type: 'float', nullable: true }) feePercentage?: number;
    @Column({ type: 'varchar', nullable: true })
    feeInterval?: 'quarterly' | 'biannual';
    @Column({ nullable: true }) preferredLanguage?: string; // 'es' | 'en'...
    @Column({ nullable: true }) preferredCurrency?: string; // 'EUR', 'USD'...

    // Fiscalidad / Riesgo
    @Column({ nullable: true }) riskProfile?: string; // conservador / moderado / agresivo...
    @Column({ nullable: true }) taxResidence?: string;

    // Bancario
    @Column({ nullable: true }) bankName?: string;
    @Column({ nullable: true }) iban?: string;
    @Column({ nullable: true }) swift?: string;

    // KYC / Marketing
    @Column({ type: 'varchar', default: 'pending' })
    kycStatus: KycStatus;

    @Column({ default: false })
    marketingOptIn: boolean;

    // Notas internas
    @Column({ type: 'text', nullable: true })
    notes?: string;

    // Relación 1–1 con User
    @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
    @JoinColumn()
    user: User;
}
