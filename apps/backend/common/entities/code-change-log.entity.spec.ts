import { CodeChangeLog } from './code-change-log.entity';

describe('CodeChangeLog Entity', () => {
  let codeChangeLog: CodeChangeLog;

  beforeEach(() => {
    codeChangeLog = new CodeChangeLog();
    codeChangeLog.id = '123e4567-e89b-12d3-a456-426614174000';
    codeChangeLog.repositoryId = '456e7890-e89b-12d3-a456-426614174001';
    codeChangeLog.codeStructureId = '789e0123-e89b-12d3-a456-426614174002';
    codeChangeLog.fromCommitSha = 'abc123def456';
    codeChangeLog.toCommitSha = 'def456ghi789';
    codeChangeLog.changeType = 'modified';
    codeChangeLog.filePath = 'src/services/user.service.ts';
    codeChangeLog.functionName = 'getUserById';
    codeChangeLog.className = 'UserService';
    codeChangeLog.changeDetails = {
      linesAdded: 5,
      linesDeleted: 2,
      linesModified: 3,
      oldStartLine: 25,
      oldEndLine: 35,
      newStartLine: 25,
      newEndLine: 38,
      oldSignature: 'getUserById(id: string): User',
      newSignature: 'getUserById(id: string): Promise<User>',
      oldFingerprint: 'old123',
      newFingerprint: 'new456',
      similarityScore: 0.85,
      diffSummary: 'Changed return type to Promise',
      affectedTests: ['user.service.spec.ts'],
      affectedDependencies: ['user.controller.ts'],
    };
    codeChangeLog.diffContent = `
-  getUserById(id: string): User {
+  getUserById(id: string): Promise<User> {
     return this.repository.findOne(id);
   }`;
    codeChangeLog.analysisResult =
      'Function signature changed to async pattern';
    codeChangeLog.analyzed = true;
    codeChangeLog.analyzedAt = new Date('2024-01-01T12:00:00Z');
    codeChangeLog.createdAt = new Date('2024-01-01T00:00:00Z');
    codeChangeLog.updatedAt = new Date('2024-01-01T00:00:00Z');
  });

  describe('Basic Properties', () => {
    it('should have all required properties', () => {
      expect(codeChangeLog.id).toBeDefined();
      expect(codeChangeLog.repositoryId).toBeDefined();
      expect(codeChangeLog.fromCommitSha).toBeDefined();
      expect(codeChangeLog.toCommitSha).toBeDefined();
      expect(codeChangeLog.changeType).toBeDefined();
      expect(codeChangeLog.filePath).toBeDefined();
      expect(codeChangeLog.changeDetails).toBeDefined();
      expect(codeChangeLog.analyzed).toBeDefined();
    });

    it('should allow optional properties to be undefined', () => {
      const minimal = new CodeChangeLog();
      expect(minimal.codeStructureId).toBeUndefined();
      expect(minimal.oldFilePath).toBeUndefined();
      expect(minimal.functionName).toBeUndefined();
      expect(minimal.oldFunctionName).toBeUndefined();
      expect(minimal.className).toBeUndefined();
      expect(minimal.oldClassName).toBeUndefined();
      expect(minimal.diffContent).toBeUndefined();
      expect(minimal.analysisResult).toBeUndefined();
      expect(minimal.analyzedAt).toBeUndefined();
    });

    it('should have correct change type values', () => {
      const validChangeTypes = [
        'added',
        'modified',
        'deleted',
        'moved',
        'renamed',
      ];

      validChangeTypes.forEach((changeType) => {
        codeChangeLog.changeType = changeType as any;
        expect(codeChangeLog.changeType).toBe(changeType);
      });
    });

    it('should handle complex changeDetails structure', () => {
      expect(codeChangeLog.changeDetails).toBeDefined();
      expect(codeChangeLog.changeDetails.linesAdded).toBe(5);
      expect(codeChangeLog.changeDetails.linesDeleted).toBe(2);
      expect(codeChangeLog.changeDetails.linesModified).toBe(3);
      expect(codeChangeLog.changeDetails.similarityScore).toBe(0.85);
      expect(codeChangeLog.changeDetails.affectedTests).toContain(
        'user.service.spec.ts',
      );
      expect(codeChangeLog.changeDetails.affectedDependencies).toContain(
        'user.controller.ts',
      );
    });
  });

  describe('Helper Methods', () => {
    describe('isSignificantChange', () => {
      it('should return true for added changes', () => {
        codeChangeLog.changeType = 'added';
        expect(codeChangeLog.isSignificantChange).toBe(true);
      });

      it('should return true for deleted changes', () => {
        codeChangeLog.changeType = 'deleted';
        expect(codeChangeLog.isSignificantChange).toBe(true);
      });

      it('should return true for large line additions', () => {
        codeChangeLog.changeType = 'modified';
        codeChangeLog.changeDetails = { linesAdded: 15 };
        expect(codeChangeLog.isSignificantChange).toBe(true);
      });

      it('should return true for large line deletions', () => {
        codeChangeLog.changeType = 'modified';
        codeChangeLog.changeDetails = { linesDeleted: 15 };
        expect(codeChangeLog.isSignificantChange).toBe(true);
      });

      it('should return true for signature changes', () => {
        codeChangeLog.changeType = 'modified';
        codeChangeLog.changeDetails = {
          linesAdded: 1,
          linesDeleted: 1,
          oldSignature: 'oldSig',
          newSignature: 'newSig',
        };
        expect(codeChangeLog.isSignificantChange).toBe(true);
      });

      it('should return false for small changes without signature change', () => {
        codeChangeLog.changeType = 'modified';
        codeChangeLog.changeDetails = {
          linesAdded: 2,
          linesDeleted: 1,
          oldSignature: 'sameSig',
          newSignature: 'sameSig',
        };
        expect(codeChangeLog.isSignificantChange).toBe(false);
      });

      it('should handle missing changeDetails properties', () => {
        codeChangeLog.changeType = 'modified';
        codeChangeLog.changeDetails = {};
        expect(codeChangeLog.isSignificantChange).toBe(false);
      });
    });

    describe('changeDescription', () => {
      it('should describe added changes correctly', () => {
        codeChangeLog.changeType = 'added';
        codeChangeLog.functionName = 'newFunction';
        codeChangeLog.filePath = 'test.ts';
        expect(codeChangeLog.changeDescription).toBe(
          'Added function newFunction in test.ts',
        );
      });

      it('should describe deleted changes correctly', () => {
        codeChangeLog.changeType = 'deleted';
        codeChangeLog.functionName = 'oldFunction';
        codeChangeLog.filePath = 'test.ts';
        expect(codeChangeLog.changeDescription).toBe(
          'Deleted function oldFunction from test.ts',
        );
      });

      it('should describe modified changes correctly', () => {
        codeChangeLog.changeType = 'modified';
        codeChangeLog.functionName = 'modifiedFunction';
        codeChangeLog.filePath = 'test.ts';
        expect(codeChangeLog.changeDescription).toBe(
          'Modified function modifiedFunction in test.ts',
        );
      });

      it('should describe moved changes correctly', () => {
        codeChangeLog.changeType = 'moved';
        codeChangeLog.functionName = 'movedFunction';
        codeChangeLog.oldFilePath = 'old/test.ts';
        codeChangeLog.filePath = 'new/test.ts';
        expect(codeChangeLog.changeDescription).toBe(
          'Moved function movedFunction from old/test.ts to new/test.ts',
        );
      });

      it('should describe renamed changes correctly', () => {
        codeChangeLog.changeType = 'renamed';
        codeChangeLog.oldFunctionName = 'oldName';
        codeChangeLog.functionName = 'newName';
        codeChangeLog.filePath = 'test.ts';
        expect(codeChangeLog.changeDescription).toBe(
          'Renamed oldName to newName in test.ts',
        );
      });

      it('should handle missing function names', () => {
        codeChangeLog.changeType = 'added';
        codeChangeLog.functionName = undefined;
        codeChangeLog.filePath = 'test.ts';
        expect(codeChangeLog.changeDescription).toBe('Added code in test.ts');
      });

      it('should handle unknown change types', () => {
        codeChangeLog.changeType = 'unknown' as any;
        codeChangeLog.filePath = 'test.ts';
        expect(codeChangeLog.changeDescription).toBe('Changed test.ts');
      });
    });

    describe('impactLevel', () => {
      it('should return high for deleted changes', () => {
        codeChangeLog.changeType = 'deleted';
        codeChangeLog.changeDetails = {};
        expect(codeChangeLog.impactLevel).toBe('high');
      });

      it('should return high for large changes (>50 lines)', () => {
        codeChangeLog.changeType = 'modified';
        codeChangeLog.changeDetails = {
          linesAdded: 30,
          linesDeleted: 25,
        };
        expect(codeChangeLog.impactLevel).toBe('high');
      });

      it('should return medium for added changes', () => {
        codeChangeLog.changeType = 'added';
        codeChangeLog.changeDetails = {
          linesAdded: 5,
        };
        expect(codeChangeLog.impactLevel).toBe('medium');
      });

      it('should return medium for moderate changes (10-50 lines)', () => {
        codeChangeLog.changeType = 'modified';
        codeChangeLog.changeDetails = {
          linesAdded: 8,
          linesDeleted: 5,
        };
        expect(codeChangeLog.impactLevel).toBe('medium');
      });

      it('should return low for small changes (<10 lines)', () => {
        codeChangeLog.changeType = 'modified';
        codeChangeLog.changeDetails = {
          linesAdded: 2,
          linesDeleted: 1,
        };
        expect(codeChangeLog.impactLevel).toBe('low');
      });

      it('should handle missing line counts', () => {
        codeChangeLog.changeType = 'modified';
        codeChangeLog.changeDetails = {};
        expect(codeChangeLog.impactLevel).toBe('low');
      });
    });
  });

  describe('Data Types', () => {
    it('should handle string properties correctly', () => {
      expect(typeof codeChangeLog.repositoryId).toBe('string');
      expect(typeof codeChangeLog.fromCommitSha).toBe('string');
      expect(typeof codeChangeLog.toCommitSha).toBe('string');
      expect(typeof codeChangeLog.changeType).toBe('string');
      expect(typeof codeChangeLog.filePath).toBe('string');
    });

    it('should handle boolean properties correctly', () => {
      expect(typeof codeChangeLog.analyzed).toBe('boolean');
    });

    it('should handle Date properties correctly', () => {
      expect(codeChangeLog.createdAt).toBeInstanceOf(Date);
      expect(codeChangeLog.updatedAt).toBeInstanceOf(Date);
      expect(codeChangeLog.analyzedAt).toBeInstanceOf(Date);
    });

    it('should handle object properties correctly', () => {
      expect(typeof codeChangeLog.changeDetails).toBe('object');
      expect(codeChangeLog.changeDetails).not.toBeNull();
    });
  });

  describe('Default Values', () => {
    it('should have analyzed property that can be set', () => {
      const newChangeLog = new CodeChangeLog();
      newChangeLog.analyzed = false;
      expect(newChangeLog.analyzed).toBe(false);

      newChangeLog.analyzed = true;
      expect(newChangeLog.analyzed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty changeDetails', () => {
      codeChangeLog.changeDetails = {};

      expect(codeChangeLog.isSignificantChange).toBe(false);
      expect(codeChangeLog.impactLevel).toBe('low');
    });

    it('should handle null values in optional fields', () => {
      codeChangeLog.functionName = undefined;
      codeChangeLog.className = undefined;
      codeChangeLog.oldFunctionName = undefined;
      codeChangeLog.oldClassName = undefined;
      codeChangeLog.oldFilePath = undefined;
      codeChangeLog.diffContent = undefined;
      codeChangeLog.analysisResult = undefined;

      expect(() => codeChangeLog.changeDescription).not.toThrow();
      expect(() => codeChangeLog.isSignificantChange).not.toThrow();
      expect(() => codeChangeLog.impactLevel).not.toThrow();
    });

    it('should handle complex nested changeDetails', () => {
      codeChangeLog.changeDetails = {
        linesAdded: 100,
        linesDeleted: 50,
        linesModified: 25,
        oldStartLine: 10,
        oldEndLine: 60,
        newStartLine: 10,
        newEndLine: 110,
        oldSignature: 'complexFunction(a: string, b: number, c: object): any',
        newSignature:
          'complexFunction(a: string, b: number, c: ComplexObject): Promise<ComplexResult>',
        oldFingerprint: 'abc123',
        newFingerprint: 'def456',
        similarityScore: 0.65,
        diffSummary: 'Major refactoring with type improvements',
        affectedTests: [
          'test1.spec.ts',
          'test2.spec.ts',
          'integration.spec.ts',
        ],
        affectedDependencies: ['controller.ts', 'service.ts', 'model.ts'],
        customMetric: 'high complexity',
        nestedData: {
          complexity: 15,
          maintainability: 60,
        },
      };

      expect(codeChangeLog.isSignificantChange).toBe(true);
      expect(codeChangeLog.impactLevel).toBe('high');
      expect(codeChangeLog.changeDetails.affectedTests).toHaveLength(3);
      expect(codeChangeLog.changeDetails.affectedDependencies).toHaveLength(3);
      expect((codeChangeLog.changeDetails as any).customMetric).toBe(
        'high complexity',
      );
      expect((codeChangeLog.changeDetails as any).nestedData.complexity).toBe(
        15,
      );
    });

    it('should handle very long diff content', () => {
      codeChangeLog.diffContent = 'line\n'.repeat(1000);
      expect(codeChangeLog.diffContent.split('\n')).toHaveLength(1001); // +1 for empty string at end
    });

    it('should handle unicode characters in content', () => {
      codeChangeLog.functionName = 'testFunction_한글_🚀';
      codeChangeLog.analysisResult = 'Analysis with unicode: 中文, العربية, 🎯';

      expect(codeChangeLog.functionName).toContain('한글');
      expect(codeChangeLog.analysisResult).toContain('🎯');
    });
  });
});
