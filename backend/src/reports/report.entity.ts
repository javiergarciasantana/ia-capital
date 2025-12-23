import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { History } from './history.entity';
import { Distribution } from './distribution.entity';
import { ChildDistribution } from './child-distribution.entity';
import { User } from '../users/user.entity'; // <--- 1. Importa la entidad User

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clienteId: number;

  @Column()
  fechaInforme: Date;

  @Column({ type: 'jsonb' })
  resumenEjecutivo: any;

  @Column({ type: 'jsonb' })
  snapshot: any;

  @ManyToOne(() => User, (user) => user.reports) 
  @JoinColumn({ name: 'clienteId' })
  client: User;

  @OneToMany(() => History, history => history.report, { cascade: true })
  history: History[];

  @OneToMany(() => Distribution, distribution => distribution.report, { cascade: true })
  distribution: Distribution[];

  @OneToMany(() => ChildDistribution, childDistribution => childDistribution.report, { cascade: true })
  child_distribution: ChildDistribution[];
}