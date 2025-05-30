import { BaseEntity } from './base.entity';

// Create a test entity that extends BaseEntity
class TestEntity extends BaseEntity {
  name: string;

  // Expose protected methods for testing
  public testBeforeInsert() {
    this.beforeInsert();
  }

  public testBeforeUpdate() {
    this.beforeUpdate();
  }
}

describe('BaseEntity', () => {
  let entity: TestEntity;

  beforeEach(() => {
    entity = new TestEntity();
  });

  it('should be defined', () => {
    expect(entity).toBeDefined();
  });

  it('should have id property', () => {
    expect(entity).toHaveProperty('id');
  });

  it('should have createdAt property', () => {
    expect(entity).toHaveProperty('createdAt');
  });

  it('should have updatedAt property', () => {
    expect(entity).toHaveProperty('updatedAt');
  });

  it('should set createdAt and updatedAt on beforeInsert', () => {
    const beforeDate = new Date();
    entity.testBeforeInsert();
    const afterDate = new Date();

    expect(entity.createdAt).toBeInstanceOf(Date);
    expect(entity.updatedAt).toBeInstanceOf(Date);
    expect(entity.createdAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
    expect(entity.createdAt.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
    expect(entity.updatedAt.getTime()).toBeLessThanOrEqual(afterDate.getTime());
  });

  it('should update updatedAt on beforeUpdate', () => {
    const initialDate = new Date('2024-01-01T00:00:00.000Z');
    entity.createdAt = initialDate;
    entity.updatedAt = initialDate;

    const beforeUpdate = new Date();
    entity.testBeforeUpdate();
    const afterUpdate = new Date();

    expect(entity.createdAt).toEqual(initialDate); // Should not change
    expect(entity.updatedAt).toBeInstanceOf(Date);
    expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    expect(entity.updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    expect(entity.updatedAt.getTime()).toBeGreaterThan(initialDate.getTime());
  });

  it('should have UUID format for id when set', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    // Simulate setting an ID (normally done by TypeORM)
    entity.id = '123e4567-e89b-12d3-a456-426614174000';
    
    expect(entity.id).toMatch(uuidRegex);
  });
}); 