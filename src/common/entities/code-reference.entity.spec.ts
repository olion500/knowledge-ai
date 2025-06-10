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
});
