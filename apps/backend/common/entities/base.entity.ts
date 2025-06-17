import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  @BeforeInsert()
  protected beforeInsert(): void {
    const now = new Date();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @BeforeUpdate()
  protected beforeUpdate(): void {
    this.updatedAt = new Date();
  }
}
