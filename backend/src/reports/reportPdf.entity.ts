import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Report } from './report.entity';

@Entity()
export class ReportPdf {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clienteId: number;

  @Column({ type: 'bytea', nullable: true }) // For Postgres; use 'blob' for MySQL
  pdf?: Buffer;

  @OneToOne(() => Report, (report) => report.reportPdf, { onDelete: 'CASCADE' })
  @JoinColumn()
  report: Report;
}