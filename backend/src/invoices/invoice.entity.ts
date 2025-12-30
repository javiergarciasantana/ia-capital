import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn} from 'typeorm';
import { User } from '../users/user.entity';

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

}