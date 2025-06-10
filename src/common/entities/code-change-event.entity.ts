import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsArray, IsDate } from 'class-validator';

export enum ChangeType {
  MODIFIED = 'modified',
  MOVED = 'moved',
  DELETED = 'deleted',
  RENAMED = 'renamed',
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('code_change_events')
@Index(['repository', 'filePath'])
@Index(['commitHash'])
@Index(['timestamp'])
export class CodeChangeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  repository: string;

  @Column({ name: 'file_path' })
  @IsNotEmpty()
  @IsString()
  filePath: string;

  @Column({
    type: 'enum',
    enum: ChangeType,
    name: 'change_type',
  })
  @IsEnum(ChangeType)
  changeType: ChangeType;

  @Column({ type: 'text', nullable: true, name: 'old_content' })
  @IsOptional()
  @IsString()
  oldContent?: string;

  @Column({ type: 'text', nullable: true, name: 'new_content' })
  @IsOptional()
  @IsString()
  newContent?: string;

  @Column({ nullable: true, name: 'old_file_path' })
  @IsOptional()
  @IsString()
  oldFilePath?: string;

  @Column('simple-array', { name: 'affected_references' })
  @IsArray()
  affectedReferences: string[];

  @Column({ name: 'commit_hash' })
  @IsNotEmpty()
  @IsString()
  commitHash: string;

  @Column({ type: 'timestamp' })
  @IsDate()
  timestamp: Date;

  @Column({
    type: 'enum',
    enum: ProcessingStatus,
    default: ProcessingStatus.PENDING,
    name: 'processing_status',
  })
  @IsEnum(ProcessingStatus)
  processingStatus: ProcessingStatus;

  @Column({ type: 'text', nullable: true, name: 'processing_error' })
  @IsOptional()
  @IsString()
  processingError?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Business logic methods
  markAsProcessing(): void {
    this.processingStatus = ProcessingStatus.PROCESSING;
  }

  markAsCompleted(): void {
    this.processingStatus = ProcessingStatus.COMPLETED;
    this.processingError = undefined;
  }

  markAsFailed(error: string): void {
    this.processingStatus = ProcessingStatus.FAILED;
    this.processingError = error;
  }

  isProcessable(): boolean {
    return this.processingStatus === ProcessingStatus.PENDING;
  }

  hasAffectedReferences(): boolean {
    return this.affectedReferences && this.affectedReferences.length > 0;
  }

  getRepositoryInfo(): { owner: string; repo: string } {
    const [owner, repo] = this.repository.split('/');
    return { owner, repo };
  }
} 