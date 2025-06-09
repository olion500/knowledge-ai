import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Repository } from './repository.entity';

@Entity('code_structures')
@Index(['repositoryId', 'filePath'])
@Index(['repositoryId', 'fingerprint'], { unique: true })
export class CodeStructure extends BaseEntity {
  @Column({ type: 'uuid' })
  repositoryId: string;

  @ManyToOne(() => Repository, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repositoryId' })
  repository: Repository;

  @Column()
  filePath: string;

  @Column()
  commitSha: string;

  @Column()
  functionName: string;

  @Column({ nullable: true })
  className?: string;

  @Column({ type: 'text' })
  signature: string;

  @Column({ unique: true })
  fingerprint: string; // MD5 hash of signature

  @Column()
  startLine: number;

  @Column()
  endLine: number;

  @Column()
  language: string; // typescript, javascript, python, java, etc.

  @Column({ type: 'text', nullable: true })
  docstring?: string;

  @Column({ type: 'jsonb', nullable: true })
  astData?: {
    parameters?: Array<{
      name: string;
      type?: string;
      defaultValue?: string;
      optional?: boolean;
    }>;
    returnType?: string;
    decorators?: string[];
    modifiers?: string[]; // public, private, static, async, etc.
    complexity?: number;
    dependencies?: string[]; // imported modules/functions
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    linesOfCode?: number;
    cyclomaticComplexity?: number;
    cognitiveComplexity?: number;
    maintainabilityIndex?: number;
    testCoverage?: number;
    [key: string]: any;
  };

  @Column({ default: true })
  active: boolean;

  // Helper methods for fingerprint generation
  get shortFingerprint(): string {
    return this.fingerprint.substring(0, 8);
  }

  get qualifiedName(): string {
    return this.className
      ? `${this.className}.${this.functionName}`
      : this.functionName;
  }

  get location(): string {
    return `${this.filePath}:${this.startLine}-${this.endLine}`;
  }
}
