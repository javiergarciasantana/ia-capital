import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, JoinColumn} from 'typeorm';
import { User } from '../users/user.entity';
import { Invoice } from './invoice.entity';

@Entity()
export class InvoicePdf {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clienteId: number;

  @Column({ type: 'bytea', nullable: true }) // For Postgres; use 'blob' for MySQL
  pdf?: Buffer;

  @ManyToOne(() => User, (user) => user.invoices) 
  @JoinColumn({ name: 'clienteId' })
  client: User;

  @OneToOne(() => Invoice)
  @JoinColumn()
  relatedInvoice: Invoice;

}