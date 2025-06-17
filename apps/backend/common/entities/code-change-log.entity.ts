import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Repository } from './repository.entity';
import { CodeStructure } from './code-structure.entity';

@Entity('code_change_logs')
@Index(['repositoryId', 'fromCommitSha'])
@Index(['repositoryId', 'toCommitSha'])
@Index(['codeStructureId'])
export class CodeChangeLog extends BaseEntity {
  @Column({ type: 'uuid' })
  repositoryId: string;

  @ManyToOne(() => Repository, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repositoryId' })
  repository: Repository;

  @Column({ type: 'uuid', nullable: true })
  codeStructureId?: string;

  @ManyToOne(() => CodeStructure, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'codeStructureId' })
  codeStructure?: CodeStructure;

  @Column()
  fromCommitSha: string;

  @Column()
  toCommitSha: string;

  @Column()
  changeType: 'added' | 'modified' | 'deleted' | 'moved' | 'renamed';

  @Column()
  filePath: string;

  @Column({ nullable: true })
  oldFilePath?: string; // for moved files

  @Column({ nullable: true })
  functionName?: string;

  @Column({ nullable: true })
  oldFunctionName?: string; // for renamed functions

  @Column({ nullable: true })
  className?: string;

  @Column({ nullable: true })
  oldClassName?: string; // for renamed classes

  @Column({ type: 'jsonb' })
  changeDetails: {
    // Line changes
    linesAdded?: number;
    linesDeleted?: number;
    linesModified?: number;

    // Position changes
    oldStartLine?: number;
    oldEndLine?: number;
    newStartLine?: number;
    newEndLine?: number;

    // Signature changes
    oldSignature?: string;
    newSignature?: string;
    oldFingerprint?: string;
    newFingerprint?: string;

    // Content changes
    similarityScore?: number; // 0-1, how similar the new version is
    diffSummary?: string;

    // Impact analysis
    affectedTests?: string[];
    affectedDependencies?: string[];

    [key: string]: any;
  };

  @Column({ type: 'text', nullable: true })
  diffContent?: string; // Raw diff content

  @Column({ type: 'text', nullable: true })
  analysisResult?: string; // LLM analysis of the change

  @Column({ default: false })
  analyzed: boolean; // Whether this change has been analyzed by LLM

  @Column({ type: 'timestamp', nullable: true })
  analyzedAt?: Date;

  // Helper methods
  get isSignificantChange(): boolean {
    const { changeDetails } = this;
    return (
      this.changeType === 'added' ||
      this.changeType === 'deleted' ||
      (changeDetails.linesAdded || 0) > 10 ||
      (changeDetails.linesDeleted || 0) > 10 ||
      Boolean(changeDetails.oldSignature !== changeDetails.newSignature)
    );
  }

  get changeDescription(): string {
    switch (this.changeType) {
      case 'added':
        return `Added ${this.functionName ? `function ${this.functionName}` : 'code'} in ${this.filePath}`;
      case 'deleted':
        return `Deleted ${this.functionName ? `function ${this.functionName}` : 'code'} from ${this.filePath}`;
      case 'modified':
        return `Modified ${this.functionName ? `function ${this.functionName}` : 'code'} in ${this.filePath}`;
      case 'moved':
        return `Moved ${this.functionName ? `function ${this.functionName}` : 'code'} from ${this.oldFilePath} to ${this.filePath}`;
      case 'renamed':
        return `Renamed ${this.oldFunctionName} to ${this.functionName} in ${this.filePath}`;
      default:
        return `Changed ${this.filePath}`;
    }
  }

  get impactLevel(): 'low' | 'medium' | 'high' {
    const { changeDetails } = this;
    const totalLines =
      (changeDetails.linesAdded || 0) + (changeDetails.linesDeleted || 0);

    if (this.changeType === 'deleted' || totalLines > 50) {
      return 'high';
    } else if (this.changeType === 'added' || totalLines > 10) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}
