import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Repository } from './repository.entity';

@Entity('sync_jobs')
@Index(['repositoryId', 'status'])
@Index(['type', 'status'])
@Index(['createdAt'])
export class SyncJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'repository_id' })
  repositoryId: string;

  @ManyToOne(() => Repository, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  @Column({
    type: 'enum',
    enum: ['scheduled', 'manual', 'webhook'],
    default: 'scheduled',
  })
  type: 'scheduled' | 'manual' | 'webhook';

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  })
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: {
    fromCommit?: string;
    toCommit?: string;
    filesAnalyzed?: number;
    functionsFound?: number;
    changesDetected?: number;
    [key: string]: any;
  };

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries: number;

  @Column({ name: 'next_retry_at', type: 'timestamp', nullable: true })
  nextRetryAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods
  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get isFailed(): boolean {
    return this.status === 'failed';
  }

  get isRunning(): boolean {
    return this.status === 'running';
  }

  get canRetry(): boolean {
    return this.isFailed && this.retryCount < this.maxRetries;
  }

  get duration(): number | null {
    if (!this.startedAt || !this.completedAt) {
      return null;
    }
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  get progress(): number {
    if (this.status === 'completed') {
      return 100;
    }
    if (this.status === 'failed' || this.status === 'cancelled') {
      return 0;
    }
    
    const metadata = this.metadata || {};
    const processed = metadata.filesAnalyzed || 0;
    const total = metadata.totalFiles || 0;
    
    if (total === 0) {
      return this.status === 'running' ? 10 : 0;
    }
    
    return Math.min(Math.floor((processed / total) * 100), 99);
  }

  updateStatus(status: SyncJob['status'], error?: string): void {
    this.status = status;
    
    if (status === 'running' && !this.startedAt) {
      this.startedAt = new Date();
    }
    
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      this.completedAt = new Date();
    }
    
    if (error) {
      this.error = error;
    }
  }

  incrementRetry(): void {
    this.retryCount += 1;
    this.nextRetryAt = new Date(Date.now() + Math.pow(2, this.retryCount) * 60000); // Exponential backoff
  }
} 