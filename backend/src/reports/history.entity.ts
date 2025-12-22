import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Report } from './report.entity';

@Entity()
export class History {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fecha: Date;

  @Column('float')
  valorNeto: number;

  @Column('float')
  rendimientoMensual: number;
  
  @Column('float')
  rendimientoYTD: number;

  @ManyToOne(() => Report, report => report.history)
  report: Report;
}