import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Document } from './document.entity';

@Entity('messages')
@Index(['source', 'sourceId'], { unique: true })
export class Message extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  source: 'slack' | 'jira';

  @Column({ type: 'varchar', length: 255 })
  sourceId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  channel: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamp' })
  sourceTimestamp: Date;

  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  topic: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'uuid', nullable: true })
  documentId: string;

  @ManyToOne(() => Document, (document) => document.messages, {
    nullable: true,
  })
  @JoinColumn({ name: 'documentId' })
  document: Document;
}
