import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Report } from './report.entity';

@Entity()
export class Distribution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  categoria: string;

  @Column('float')
  valor: number;

  @Column('float')
  porcentaje: number;

  @ManyToOne(() => Report, report => report.distribution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportId' })
  report: Report;
}