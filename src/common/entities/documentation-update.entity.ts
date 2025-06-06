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
import { SyncJob } from './sync-job.entity';

@Entity('documentation_updates')
@Index(['repositoryId', 'status'])
@Index(['priority', 'status'])
@Index(['createdAt'])
export class DocumentationUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'repository_id' })
  repositoryId: string;

  @ManyToOne(() => Repository, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  @Column({ name: 'sync_job_id', nullable: true })
  syncJobId?: string;

  @ManyToOne(() => SyncJob, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sync_job_id' })
  syncJob?: SyncJob;

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'completed', 'rejected', 'failed'],
    default: 'pending',
  })
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'failed';

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  })
  priority: 'low' | 'medium' | 'high';

  @Column({
    type: 'enum',
    enum: ['readme', 'api_docs', 'changelog', 'multiple'],
  })
  updateType: 'readme' | 'api_docs' | 'changelog' | 'multiple';

  @Column({ type: 'int', default: 0 })
  confidence: number; // 0-100

  @Column({ type: 'text' })
  reasoning: string;

  @Column({ type: 'json' })
  analysisResult: {
    shouldUpdate: boolean;
    confidence: number;
    reasoning: string;
    suggestedUpdates: {
      readme?: {
        shouldUpdate: boolean;
        sections: string[];
        priority: 'low' | 'medium' | 'high';
        suggestedContent?: string;
      };
      apiDocs?: {
        shouldUpdate: boolean;
        affectedEndpoints: string[];
        priority: 'low' | 'medium' | 'high';
        suggestedContent?: string;
      };
      changelog?: {
        shouldUpdate: boolean;
        entryType: 'patch' | 'minor' | 'major';
        priority: 'low' | 'medium' | 'high';
        suggestedEntry?: string;
      };
    };
    metadata: {
      analysisDate: string;
      llmModel: string;
      processingTime: number;
    };
  };

  @Column({ type: 'json', nullable: true })
  changeContext?: {
    commits: {
      from: string;
      to: string;
      count: number;
    };
    changes: {
      added: number;
      modified: number;
      deleted: number;
    };
    complexity: {
      average: number;
      highest: number;
    };
  };

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo?: string; // User ID who should handle the update

  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  completionNotes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods
  get isOverdue(): boolean {
    return this.dueDate ? new Date() > this.dueDate : false;
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get priorityScore(): number {
    const priorityScores = { low: 1, medium: 2, high: 3 };
    return priorityScores[this.priority] * (this.confidence / 100);
  }

  get estimatedEffort(): 'small' | 'medium' | 'large' {
    const updates = this.analysisResult.suggestedUpdates;
    let updateCount = 0;
    
    if (updates.readme?.shouldUpdate) updateCount++;
    if (updates.apiDocs?.shouldUpdate) updateCount++;
    if (updates.changelog?.shouldUpdate) updateCount++;

    if (updateCount >= 3 || this.priority === 'high') return 'large';
    if (updateCount === 2 || this.priority === 'medium') return 'medium';
    return 'small';
  }

  updateStatus(
    status: DocumentationUpdate['status'],
    notes?: string,
    assignedTo?: string,
  ): void {
    this.status = status;
    
    if (status === 'completed') {
      this.completedAt = new Date();
    }
    
    if (notes) {
      this.completionNotes = notes;
    }
    
    if (assignedTo) {
      this.assignedTo = assignedTo;
    }
  }

  setDueDate(priority?: 'low' | 'medium' | 'high'): void {
    const basePriority = priority || this.priority;
    const daysToAdd = basePriority === 'high' ? 1 : basePriority === 'medium' ? 3 : 7;
    
    this.dueDate = new Date();
    this.dueDate.setDate(this.dueDate.getDate() + daysToAdd);
  }
} 