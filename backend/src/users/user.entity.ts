import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { UserProfile } from './user-profile.entity';
import { Report } from '../reports/report.entity';
import { History } from '../history/history.entity';
import { Invoice } from '../invoices/invoice.entity'

export type UserRole = 'client' | 'admin' | 'superadmin';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: 'client' })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @OneToOne(() => UserProfile, (p) => p.user, {
    cascade: true,
    eager: true,
    nullable: true,
  })
  @JoinColumn() // la FK se guarda en la tabla users
  profile?: UserProfile | null;

  @OneToMany(() => Report, (report) => report.client)
  reports: Report[];

  @OneToMany(() => History, (history) => history.clienteId)
  history: History[];

  @OneToMany(() => Invoice, (invoice) => invoice.client)
  invoices: Invoice[];
}