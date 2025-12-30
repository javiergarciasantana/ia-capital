import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, JoinColumn} from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity()
export class InvoicePdf {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bytea', nullable: true }) // For Postgres; use 'blob' for MySQL
  pdf?: Buffer;

  @OneToOne(() => Invoice)
  @JoinColumn()
  relatedInvoice: Invoice;

}