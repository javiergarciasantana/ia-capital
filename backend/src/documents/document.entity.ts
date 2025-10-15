import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  type: string;

  @Column()
  date: Date;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  month: string;

  @Column({ nullable: true })
  year: string;

  @Column({ nullable: true }) // 🔧 antes no era nullable
  bank: string;

  @ManyToOne(() => User, (user) => user.documents, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL', 
  })
  user: User | null;
}
