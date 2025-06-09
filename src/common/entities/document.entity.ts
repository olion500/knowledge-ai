import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Message } from './message.entity';

@Entity('documents')
@Index(['topic', 'title'])
export class Document extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  topic: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ type: 'simple-array', nullable: true })
  participants: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  githubPrUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  githubCommitSha: string;

  @Column({ type: 'boolean', default: false })
  published: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date;

  @OneToMany(() => Message, (message) => message.document)
  messages: Message[];
}
