import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, JoinColumn} from 'typeorm';
import { User } from '../users/user.entity';
import { InvoicePdf } from './invoicePdf.entity';

@Entity()
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clienteId: number;

  @Column()
  fechaFactura: Date;

  @Column('text', { nullable: true})
  descripcion: string;

  @Column('float')
  importe: number;

  @ManyToOne(() => User, (user) => user.invoices) 
  @JoinColumn({ name: 'clienteId' })
  client: User;

  @OneToOne(() => InvoicePdf, (invoicePdf) => invoicePdf.pdf, { cascade: true })
  @JoinColumn()
  invoicePdf: InvoicePdf;
}