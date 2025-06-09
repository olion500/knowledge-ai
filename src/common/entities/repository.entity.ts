import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('repositories')
@Index(['owner', 'name'], { unique: true })
export class Repository extends BaseEntity {
  @Column()
  owner: string;

  @Column()
  name: string;

  @Column()
  fullName: string; // owner/name 형태

  @Column({ default: 'main' })
  defaultBranch: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  language?: string;

  @Column({ nullable: true })
  lastCommitSha?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  @Column({ default: true })
  active: boolean;

  @Column({ default: false })
  isPrivate: boolean;

  @Column({ type: 'jsonb', nullable: true })
  syncConfig?: {
    enabled?: boolean; // 동기화 활성화 여부
    branch?: string; // 동기화 대상 브랜치
    includePaths?: string[]; // 분석할 경로 패턴
    excludePaths?: string[]; // 제외할 경로 패턴
    fileExtensions?: string[]; // 분석할 파일 확장자
    syncFrequency?: 'daily' | 'weekly' | 'manual';
    autoDocGeneration?: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    stars?: number;
    forks?: number;
    size?: number;
    topics?: string[];
    [key: string]: any;
  };

  // Repository의 URL들
  get htmlUrl(): string {
    return `https://github.com/${this.fullName}`;
  }

  get cloneUrl(): string {
    return `https://github.com/${this.fullName}.git`;
  }

  get apiUrl(): string {
    return `https://api.github.com/repos/${this.fullName}`;
  }
}
