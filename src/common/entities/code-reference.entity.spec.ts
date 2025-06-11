import { validate } from 'class-validator';
import { CodeReference } from './code-reference.entity';

describe('CodeReference Entity', () => {
  let codeReference: CodeReference;

  beforeEach(() => {
    codeReference = new CodeReference();
  });

  describe('Validation', () => {
    it('should be valid with all required fields', async () => {
      codeReference.repositoryOwner = 'testowner';
      codeReference.repositoryName = 'testrepo';
      codeReference.filePath = 'src/test.ts';
      codeReference.referenceType = 'line';
      codeReference.startLine = 10;
  
      codeReference.content = 'console.log("test");';
      codeReference.hash = 'hash123';
      codeReference.isActive = true;
      codeReference.isStale = false; // Add default value for new field
      codeReference.dependencies = []; // Add default value for new field

      const errors = await validate(codeReference);
      expect(errors).toHaveLength(0);
    });

    it('should be invalid without repositoryOwner', async () => {
      codeReference.repositoryName = 'testrepo';
      codeReference.filePath = 'src/test.ts';
      codeReference.referenceType = 'line';

      const errors = await validate(codeReference);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('repositoryOwner');
    });

    it('should be invalid without repositoryName', async () => {
      codeReference.repositoryOwner = 'testowner';
      codeReference.filePath = 'src/test.ts';
      codeReference.referenceType = 'line';

      const errors = await validate(codeReference);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('repositoryName');
    });

    it('should be invalid without filePath', async () => {
      codeReference.repositoryOwner = 'testowner';
      codeReference.repositoryName = 'testrepo';
      codeReference.referenceType = 'line';

      const errors = await validate(codeReference);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('filePath');
    });

    it('should validate referenceType enum values', async () => {
      codeReference.repositoryOwner = 'testowner';
      codeReference.repositoryName = 'testrepo';
      codeReference.filePath = 'src/test.ts';
      codeReference.referenceType = 'invalid' as any;

      const errors = await validate(codeReference);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('referenceType');
    });
  });

  describe('Business Logic', () => {
    it('should generate proper repository full name', () => {
      codeReference.repositoryOwner = 'testowner';
      codeReference.repositoryName = 'testrepo';

      expect(codeReference.getFullRepositoryName()).toBe('testowner/testrepo');
    });

    it('should check if reference is line-based', () => {
      codeReference.referenceType = 'line';
      codeReference.startLine = 10;

      expect(codeReference.isLineBased()).toBe(true);
    });

    it('should check if reference is function-based', () => {
      codeReference.referenceType = 'function';
      codeReference.functionName = 'testFunction';

      expect(codeReference.isFunctionBased()).toBe(true);
    });

    it('should check if reference is range-based', () => {
      codeReference.referenceType = 'range';
      codeReference.startLine = 10;
      codeReference.endLine = 20;

      expect(codeReference.isRangeBased()).toBe(true);
    });

    it('should validate content hash', () => {
      const content = 'console.log("test");';
      codeReference.content = content;
      codeReference.generateHash();

      expect(codeReference.hash).toBeDefined();
      expect(codeReference.hash.length).toBeGreaterThan(0);
      expect(codeReference.validateHash()).toBe(true);
    });
  });

  describe('Phase 2: Smart Code Tracking', () => {
    beforeEach(() => {
      codeReference.repositoryOwner = 'testowner';
      codeReference.repositoryName = 'testrepo';
      codeReference.filePath = 'src/test.ts';
      codeReference.referenceType = 'line';
      codeReference.content = 'console.log("test");';
      codeReference.hash = 'hash123';
      codeReference.isActive = true;
      codeReference.isStale = false;
      codeReference.dependencies = [];
    });

    it('should mark as stale', () => {
      codeReference.markAsStale();
      expect(codeReference.isStale).toBe(true);
    });

    it('should mark as fresh', () => {
      codeReference.isStale = true;
      codeReference.markAsFresh();
      expect(codeReference.isStale).toBe(false);
    });

    it('should update commit info', () => {
      const commitSha = 'abc123';
      const lastModified = new Date();

      codeReference.updateCommitInfo(commitSha, lastModified);

      expect(codeReference.commitSha).toBe(commitSha);
      expect(codeReference.lastModified).toBe(lastModified);
      expect(codeReference.isStale).toBe(false);
    });

    it('should manage dependencies', () => {
      const filePath1 = 'src/utils.ts';
      const filePath2 = 'src/types.ts';

      // Add dependencies
      codeReference.addDependency(filePath1);
      codeReference.addDependency(filePath2);

      expect(codeReference.dependencies).toContain(filePath1);
      expect(codeReference.dependencies).toContain(filePath2);
      expect(codeReference.getDependencyCount()).toBe(2);
      expect(codeReference.hasDependency(filePath1)).toBe(true);

      // Remove dependency
      codeReference.removeDependency(filePath1);
      expect(codeReference.dependencies).not.toContain(filePath1);
      expect(codeReference.getDependencyCount()).toBe(1);
      expect(codeReference.hasDependency(filePath1)).toBe(false);
    });

    it('should not add duplicate dependencies', () => {
      const filePath = 'src/utils.ts';

      codeReference.addDependency(filePath);
      codeReference.addDependency(filePath); // Try to add again

      expect(codeReference.dependencies).toEqual([filePath]);
      expect(codeReference.getDependencyCount()).toBe(1);
    });
  });
});
