import { validate } from 'class-validator';
import { CodeChangeEvent, ChangeType, ProcessingStatus } from './code-change-event.entity';

describe('CodeChangeEvent Entity', () => {
  let codeChangeEvent: CodeChangeEvent;

  beforeEach(() => {
    codeChangeEvent = new CodeChangeEvent();
    codeChangeEvent.repository = 'owner/repo';
    codeChangeEvent.filePath = 'src/test.ts';
    codeChangeEvent.changeType = ChangeType.MODIFIED;
    codeChangeEvent.affectedReferences = ['ref1', 'ref2'];
    codeChangeEvent.commitHash = 'abc123';
    codeChangeEvent.timestamp = new Date();
    codeChangeEvent.processingStatus = ProcessingStatus.PENDING;
  });

  describe('Validation', () => {
    it('should pass validation with valid data', async () => {
      const errors = await validate(codeChangeEvent);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with empty repository', async () => {
      codeChangeEvent.repository = '';
      const errors = await validate(codeChangeEvent);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('repository');
    });

    it('should fail validation with empty filePath', async () => {
      codeChangeEvent.filePath = '';
      const errors = await validate(codeChangeEvent);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('filePath');
    });

    it('should fail validation with invalid changeType', async () => {
      codeChangeEvent.changeType = 'invalid' as ChangeType;
      const errors = await validate(codeChangeEvent);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('changeType');
    });

    it('should fail validation with empty commitHash', async () => {
      codeChangeEvent.commitHash = '';
      const errors = await validate(codeChangeEvent);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('commitHash');
    });

    it('should allow optional fields to be undefined', async () => {
      codeChangeEvent.oldContent = undefined;
      codeChangeEvent.newContent = undefined;
      codeChangeEvent.oldFilePath = undefined;
      codeChangeEvent.processingError = undefined;
      const errors = await validate(codeChangeEvent);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Business Logic Methods', () => {
    describe('markAsProcessing', () => {
      it('should change status to PROCESSING', () => {
        codeChangeEvent.markAsProcessing();
        expect(codeChangeEvent.processingStatus).toBe(ProcessingStatus.PROCESSING);
      });
    });

    describe('markAsCompleted', () => {
      it('should change status to COMPLETED and clear error', () => {
        codeChangeEvent.processingError = 'Some error';
        codeChangeEvent.markAsCompleted();
        expect(codeChangeEvent.processingStatus).toBe(ProcessingStatus.COMPLETED);
        expect(codeChangeEvent.processingError).toBeUndefined();
      });
    });

    describe('markAsFailed', () => {
      it('should change status to FAILED and set error message', () => {
        const errorMessage = 'Processing failed';
        codeChangeEvent.markAsFailed(errorMessage);
        expect(codeChangeEvent.processingStatus).toBe(ProcessingStatus.FAILED);
        expect(codeChangeEvent.processingError).toBe(errorMessage);
      });
    });

    describe('isProcessable', () => {
      it('should return true when status is PENDING', () => {
        codeChangeEvent.processingStatus = ProcessingStatus.PENDING;
        expect(codeChangeEvent.isProcessable()).toBe(true);
      });

      it('should return false when status is PROCESSING', () => {
        codeChangeEvent.processingStatus = ProcessingStatus.PROCESSING;
        expect(codeChangeEvent.isProcessable()).toBe(false);
      });

      it('should return false when status is COMPLETED', () => {
        codeChangeEvent.processingStatus = ProcessingStatus.COMPLETED;
        expect(codeChangeEvent.isProcessable()).toBe(false);
      });

      it('should return false when status is FAILED', () => {
        codeChangeEvent.processingStatus = ProcessingStatus.FAILED;
        expect(codeChangeEvent.isProcessable()).toBe(false);
      });
    });

    describe('hasAffectedReferences', () => {
      it('should return true when affectedReferences has items', () => {
        codeChangeEvent.affectedReferences = ['ref1', 'ref2'];
        expect(codeChangeEvent.hasAffectedReferences()).toBe(true);
      });

      it('should return false when affectedReferences is empty', () => {
        codeChangeEvent.affectedReferences = [];
        expect(codeChangeEvent.hasAffectedReferences()).toBe(false);
      });

      it('should return false when affectedReferences is empty array', () => {
        codeChangeEvent.affectedReferences = [];
        expect(codeChangeEvent.hasAffectedReferences()).toBe(false);
      });
    });

    describe('getRepositoryInfo', () => {
      it('should parse repository string correctly', () => {
        codeChangeEvent.repository = 'facebook/react';
        const info = codeChangeEvent.getRepositoryInfo();
        expect(info.owner).toBe('facebook');
        expect(info.repo).toBe('react');
      });

      it('should handle repository with multiple slashes', () => {
        codeChangeEvent.repository = 'microsoft/TypeScript';
        const info = codeChangeEvent.getRepositoryInfo();
        expect(info.owner).toBe('microsoft');
        expect(info.repo).toBe('TypeScript');
      });
    });
  });

  describe('Change Type Scenarios', () => {
    it('should handle MODIFIED change type', () => {
      codeChangeEvent.changeType = ChangeType.MODIFIED;
      codeChangeEvent.oldContent = 'old code';
      codeChangeEvent.newContent = 'new code';
      expect(codeChangeEvent.changeType).toBe(ChangeType.MODIFIED);
    });

    it('should handle MOVED change type', () => {
      codeChangeEvent.changeType = ChangeType.MOVED;
      codeChangeEvent.oldFilePath = 'old/path.ts';
      codeChangeEvent.filePath = 'new/path.ts';
      expect(codeChangeEvent.changeType).toBe(ChangeType.MOVED);
    });

    it('should handle DELETED change type', () => {
      codeChangeEvent.changeType = ChangeType.DELETED;
      codeChangeEvent.oldContent = 'deleted code';
      expect(codeChangeEvent.changeType).toBe(ChangeType.DELETED);
    });

    it('should handle RENAMED change type', () => {
      codeChangeEvent.changeType = ChangeType.RENAMED;
      codeChangeEvent.oldFilePath = 'oldfile.ts';
      codeChangeEvent.filePath = 'newfile.ts';
      expect(codeChangeEvent.changeType).toBe(ChangeType.RENAMED);
    });
  });
}); 