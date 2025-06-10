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



  @Column({ default: true })
  active: boolean;

  @Column({ default: false })
  isPrivate: boolean;



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
