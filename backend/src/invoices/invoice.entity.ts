import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { InvoicePdf } from './invoicePdf.entity';
import { Report } from '../reports/report.entity';

@Entity()
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clienteId: number;

  @Column()
  fechaFactura: Date;

  @Column('text', { nullable: true })
  descripcion: string;

  @Column('float')
  importe: number;


  @OneToOne(() => Report, (report) => report.invoice, { onDelete: 'CASCADE' })
  @JoinColumn()
  report: Report;

  @OneToOne(() => InvoicePdf, (invoicePdf) => invoicePdf.invoice,  { cascade: true, onDelete: 'CASCADE' })
  invoicePdf: InvoicePdf;
}