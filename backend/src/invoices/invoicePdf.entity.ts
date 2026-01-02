import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity()
export class InvoicePdf {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clienteId: number;

  @Column({ type: 'bytea', nullable: true }) // For Postgres; use 'blob' for MySQL
  pdf?: Buffer;

  @OneToOne(() => Invoice, (invoice) => invoice.invoicePdf, { onDelete: 'CASCADE' })
  @JoinColumn()
  invoice: Invoice;
}