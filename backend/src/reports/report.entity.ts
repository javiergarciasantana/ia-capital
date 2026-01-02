import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { Distribution } from './distribution.entity';
import { ChildDistribution } from './child-distribution.entity';
import { User } from '../users/user.entity';
import { Invoice } from 'src/invoices/invoice.entity';

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clienteId: number;

  @Column()
  fechaInforme: Date;

  @Column('text', { nullable: true })
  resumenGlobal: string;

  @Column('text', { nullable: true })
  resumenTailored: string;

  @Column({ type: 'jsonb' })
  resumenEjecutivo: any;

  @Column({ type: 'jsonb' })
  snapshot: any;

  @ManyToOne(() => User, (user) => user.reports, { onDelete: 'CASCADE'} )
  @JoinColumn({ name: 'clienteId' })
  client: User;

  @OneToMany(() => Distribution, distribution => distribution.report, { cascade: true, onDelete: 'CASCADE' })
  distribution: Distribution[];

  @OneToMany(() => ChildDistribution, childDistribution => childDistribution.report, { cascade: true, onDelete: 'CASCADE' })
  child_distribution: ChildDistribution[];

  @OneToOne(() => Invoice, (invoice) => invoice.report, { cascade: true, onDelete: 'CASCADE' })
  invoice: Invoice;
}