import { CodeStructure } from './code-structure.entity';

describe('CodeStructure Entity', () => {
  let codeStructure: CodeStructure;

  beforeEach(() => {
    codeStructure = new CodeStructure();
    codeStructure.id = '123e4567-e89b-12d3-a456-426614174000';
    codeStructure.repositoryId = '456e7890-e89b-12d3-a456-426614174001';
    codeStructure.filePath = 'src/services/user.service.ts';
    codeStructure.commitSha = 'abc123def456';
    codeStructure.functionName = 'getUserById';
    codeStructure.className = 'UserService';
    codeStructure.signature = 'getUserById(id: string): Promise<User>';
    codeStructure.fingerprint = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
    codeStructure.startLine = 25;
    codeStructure.endLine = 35;
    codeStructure.language = 'typescript';
    codeStructure.docstring = 'Retrieves a user by their ID';
    codeStructure.astData = {
      parameters: [
        {
          name: 'id',
          type: 'string',
          optional: false,
        },
      ],
      returnType: 'Promise<User>',
      decorators: ['@Injectable()'],
      modifiers: ['public', 'async'],
      complexity: 3,
      dependencies: ['User', 'Repository'],
    };
    codeStructure.metadata = {
      linesOfCode: 10,
      cyclomaticComplexity: 3,
      cognitiveComplexity: 2,
      maintainabilityIndex: 85,
      testCoverage: 90,
    };
    codeStructure.active = true;
    codeStructure.createdAt = new Date('2024-01-01T00:00:00Z');
    codeStructure.updatedAt = new Date('2024-01-01T00:00:00Z');
  });

  describe('Basic Properties', () => {
    it('should have all required properties', () => {
      expect(codeStructure.id).toBeDefined();
      expect(codeStructure.repositoryId).toBeDefined();
      expect(codeStructure.filePath).toBeDefined();
      expect(codeStructure.commitSha).toBeDefined();
      expect(codeStructure.functionName).toBeDefined();
      expect(codeStructure.signature).toBeDefined();
      expect(codeStructure.fingerprint).toBeDefined();
      expect(codeStructure.startLine).toBeDefined();
      expect(codeStructure.endLine).toBeDefined();
      expect(codeStructure.language).toBeDefined();
      expect(codeStructure.active).toBeDefined();
    });

    it('should allow optional properties to be undefined', () => {
      const minimal = new CodeStructure();
      expect(minimal.className).toBeUndefined();
      expect(minimal.docstring).toBeUndefined();
      expect(minimal.astData).toBeUndefined();
      expect(minimal.metadata).toBeUndefined();
    });

    it('should handle complex AST data structure', () => {
      expect(codeStructure.astData).toBeDefined();
      expect(codeStructure.astData?.parameters).toHaveLength(1);
      expect(codeStructure.astData?.parameters?.[0].name).toBe('id');
      expect(codeStructure.astData?.returnType).toBe('Promise<User>');
      expect(codeStructure.astData?.decorators).toContain('@Injectable()');
      expect(codeStructure.astData?.modifiers).toContain('async');
      expect(codeStructure.astData?.complexity).toBe(3);
      expect(codeStructure.astData?.dependencies).toContain('User');
    });

    it('should handle complex metadata structure', () => {
      expect(codeStructure.metadata).toBeDefined();
      expect(codeStructure.metadata?.linesOfCode).toBe(10);
      expect(codeStructure.metadata?.cyclomaticComplexity).toBe(3);
      expect(codeStructure.metadata?.cognitiveComplexity).toBe(2);
      expect(codeStructure.metadata?.maintainabilityIndex).toBe(85);
      expect(codeStructure.metadata?.testCoverage).toBe(90);
    });
  });

  describe('Helper Methods', () => {
    describe('shortFingerprint', () => {
      it('should return first 8 characters of fingerprint', () => {
        expect(codeStructure.shortFingerprint).toBe('a1b2c3d4');
      });

      it('should handle short fingerprints', () => {
        codeStructure.fingerprint = 'abc';
        expect(codeStructure.shortFingerprint).toBe('abc');
      });
    });

    describe('qualifiedName', () => {
      it('should return className.functionName when className exists', () => {
        expect(codeStructure.qualifiedName).toBe('UserService.getUserById');
      });

      it('should return only functionName when className is null', () => {
        codeStructure.className = undefined;
        expect(codeStructure.qualifiedName).toBe('getUserById');
      });

      it('should return only functionName when className is undefined', () => {
        codeStructure.className = undefined;
        expect(codeStructure.qualifiedName).toBe('getUserById');
      });
    });

    describe('location', () => {
      it('should return filePath:startLine-endLine format', () => {
        expect(codeStructure.location).toBe('src/services/user.service.ts:25-35');
      });

      it('should handle single line functions', () => {
        codeStructure.startLine = 42;
        codeStructure.endLine = 42;
        expect(codeStructure.location).toBe('src/services/user.service.ts:42-42');
      });
    });
  });

  describe('Default Values', () => {
    it('should have active property that can be set', () => {
      const newStructure = new CodeStructure();
      newStructure.active = true;
      expect(newStructure.active).toBe(true);
      
      newStructure.active = false;
      expect(newStructure.active).toBe(false);
    });
  });

  describe('Data Types', () => {
    it('should handle numeric properties correctly', () => {
      expect(typeof codeStructure.startLine).toBe('number');
      expect(typeof codeStructure.endLine).toBe('number');
      expect(codeStructure.startLine).toBeGreaterThan(0);
      expect(codeStructure.endLine).toBeGreaterThanOrEqual(codeStructure.startLine);
    });

    it('should handle boolean properties correctly', () => {
      expect(typeof codeStructure.active).toBe('boolean');
    });

    it('should handle string properties correctly', () => {
      expect(typeof codeStructure.repositoryId).toBe('string');
      expect(typeof codeStructure.filePath).toBe('string');
      expect(typeof codeStructure.commitSha).toBe('string');
      expect(typeof codeStructure.functionName).toBe('string');
      expect(typeof codeStructure.signature).toBe('string');
      expect(typeof codeStructure.fingerprint).toBe('string');
      expect(typeof codeStructure.language).toBe('string');
    });

    it('should handle Date properties correctly', () => {
      expect(codeStructure.createdAt).toBeInstanceOf(Date);
      expect(codeStructure.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      codeStructure.functionName = '';
      codeStructure.className = '';
      expect(codeStructure.qualifiedName).toBe('');
    });

    it('should handle very long fingerprints', () => {
      codeStructure.fingerprint = 'a'.repeat(100);
      expect(codeStructure.shortFingerprint).toBe('a'.repeat(8));
    });

    it('should handle complex nested astData', () => {
      codeStructure.astData = {
        parameters: [
          {
            name: 'config',
            type: 'UserConfig',
            defaultValue: '{}',
            optional: true,
          },
          {
            name: 'options',
            type: 'RequestOptions',
            optional: false,
          },
        ],
        returnType: 'Promise<User | null>',
        decorators: ['@Injectable()', '@Validate()'],
        modifiers: ['public', 'async', 'static'],
        complexity: 8,
        dependencies: ['User', 'UserConfig', 'RequestOptions', 'Validator'],
        customProperty: 'custom value',
      };

      expect(codeStructure.astData.parameters).toHaveLength(2);
      expect(codeStructure.astData.decorators).toHaveLength(2);
      expect(codeStructure.astData.modifiers).toHaveLength(3);
      expect(codeStructure.astData.dependencies).toHaveLength(4);
      expect((codeStructure.astData as any).customProperty).toBe('custom value');
    });

    it('should handle complex nested metadata', () => {
      codeStructure.metadata = {
        linesOfCode: 150,
        cyclomaticComplexity: 12,
        cognitiveComplexity: 8,
        maintainabilityIndex: 65,
        testCoverage: 85,
        customMetric: 42,
        nestedData: {
          score: 95,
          category: 'high',
        },
      };

      expect(codeStructure.metadata.linesOfCode).toBe(150);
      expect((codeStructure.metadata as any).customMetric).toBe(42);
      expect((codeStructure.metadata as any).nestedData.score).toBe(95);
    });
  });
}); 