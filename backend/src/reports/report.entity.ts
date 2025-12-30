import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn} from 'typeorm';
import { Distribution } from './distribution.entity';
import { ChildDistribution } from './child-distribution.entity';
import { User } from '../users/user.entity';

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clienteId: number;

  @Column()
  fechaInforme: Date;

  @Column('text', { nullable: true})
  resumenGlobal: string;

  @Column('text', { nullable: true})
  resumenTailored: string;

  @Column({ type: 'jsonb' })
  resumenEjecutivo: any;

  @Column({ type: 'jsonb' })
  snapshot: any;

  @ManyToOne(() => User, (user) => user.reports) 
  @JoinColumn({ name: 'clienteId' })
  client: User;

  @OneToMany(() => Distribution, distribution => distribution.report, { cascade: true })
  distribution: Distribution[];

  @OneToMany(() => ChildDistribution, childDistribution => childDistribution.report, { cascade: true })
  child_distribution: ChildDistribution[];
}