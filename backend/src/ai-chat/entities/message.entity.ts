import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Conversation } from './conversation.entity';

export type ChatRole = 'system' | 'user' | 'assistant';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id' })
  conversationId!: string;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @Column({ type: 'varchar', length: 16 })
  role!: ChatRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'tokens_in', type: 'int', nullable: true })
  tokensIn?: number;

  @Column({ name: 'tokens_out', type: 'int', nullable: true })
  tokensOut?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
