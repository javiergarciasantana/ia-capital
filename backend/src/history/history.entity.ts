import { Entity, PrimaryGeneratedColumn, Column, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
@Unique(['clienteId', 'fecha']) // Prevent duplicates
export class History {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clienteId: number;

  @Column()
  fecha: Date; 

  @Column('decimal', { precision: 10, scale: 2 })
  valorNeto: number;

  @Column('decimal', { precision: 10, scale: 2 })
  rendimientoMensual: number;

  @Column('decimal', { precision: 10, scale: 2 })
  rendimientoYTD: number;

  @ManyToOne(() => User, (user) => user.reports) 
  @JoinColumn({ name: 'clienteId' })
  client: User;

}