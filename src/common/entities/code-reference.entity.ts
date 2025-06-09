import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { DocumentCodeLink } from './document-code-link.entity';
import { ReferenceType } from '../interfaces/code-reference.interface';
import { createHash } from 'crypto';

@Entity('code_references')
export class CodeReference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  repositoryOwner: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  repositoryName: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  filePath: string;

  @Column({ type: 'enum', enum: ['line', 'function', 'range'] })
  @IsEnum(['line', 'function', 'range'])
  referenceType: ReferenceType;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  startLine?: number;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  endLine?: number;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  functionName?: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  lastCommitSha: string;

  @Column('text')
  @IsNotEmpty()
  @IsString()
  content: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  hash: string;

  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => DocumentCodeLink, (link) => link.codeReference)
  documentLinks: DocumentCodeLink[];

  // Business logic methods
  getFullRepositoryName(): string {
    return `${this.repositoryOwner}/${this.repositoryName}`;
  }

  isLineBased(): boolean {
    return this.referenceType === 'line' && this.startLine !== undefined;
  }

  isFunctionBased(): boolean {
    return this.referenceType === 'function' && this.functionName !== undefined;
  }

  isRangeBased(): boolean {
    return (
      this.referenceType === 'range' &&
      this.startLine !== undefined &&
      this.endLine !== undefined
    );
  }

  generateHash(): void {
    this.hash = createHash('sha256').update(this.content).digest('hex');
  }

  validateHash(): boolean {
    const currentHash = createHash('sha256').update(this.content).digest('hex');
    return this.hash === currentHash;
  }
}
