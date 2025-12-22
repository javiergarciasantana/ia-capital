import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Report } from './report.entity';

@Entity()
export class ChildDistribution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  categoria: string;

  @Column('float')
  valor: number;

  @Column('float')
  porcentaje: number;

  @ManyToOne(() => Report, report => report.child_distribution)
  report: Report;
}