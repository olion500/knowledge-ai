import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SmartCodeTrackingService } from './smart-code-tracking.service';
import {
  CodeChangeEvent,
  ChangeType,
} from '../../../common/entities/code-change-event.entity';
import { CodeReference } from '../../../common/entities/code-reference.entity';
import { CodeExtractorService } from './code-extractor.service';
import { NotificationService } from './notification.service';
import {
  FunctionSignature,
  CodeMovementResult,
} from '../../../common/interfaces/code-tracking.interface';

describe('SmartCodeTrackingService', () => {
  let service: SmartCodeTrackingService;
  let codeReferenceRepository: Repository<CodeReference>;
  let codeExtractorService: CodeExtractorService;
  let notificationService: NotificationService;

  const mockCodeReferenceRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockCodeExtractorService = {
    extractCodeFromGitHub: jest.fn(),
    getFileContent: jest.fn(),
  };

  const mockNotificationService = {
    sendChangeNotification: jest.fn(),
    sendConflictNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartCodeTrackingService,
        {
          provide: getRepositoryToken(CodeReference),
          useValue: mockCodeReferenceRepository,
        },
        {
          provide: CodeExtractorService,
          useValue: mockCodeExtractorService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<SmartCodeTrackingService>(SmartCodeTrackingService);
    codeReferenceRepository = module.get<Repository<CodeReference>>(
      getRepositoryToken(CodeReference),
    );
    codeExtractorService =
      module.get<CodeExtractorService>(CodeExtractorService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processCodeChange', () => {
    it('should process modified files successfully', async () => {
      const changeEvent = new CodeChangeEvent();
      changeEvent.changeType = ChangeType.MODIFIED;
      changeEvent.repository = 'owner/repo';
      changeEvent.filePath = 'src/test.ts';
      changeEvent.affectedReferences = ['ref1'];

      const codeReference = {
        id: 'ref1',
        repository: 'owner/repo',
        filePath: 'src/test.ts',
        startLine: 10,
        endLine: 20,
        contentHash: 'old-hash',
      };

      mockCodeReferenceRepository.findOne.mockResolvedValue(codeReference);
      mockCodeExtractorService.getFileContent.mockResolvedValue(
        'new file content',
      );
      jest.spyOn(service, 'updateCodeReference').mockResolvedValue();

      const result = await service.processCodeChange(changeEvent);

      expect(result).toBe(true);
      expect(mockCodeReferenceRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'ref1' },
      });
      expect(service.updateCodeReference).toHaveBeenCalledWith(
        codeReference,
        'new file content',
      );
    });

    it('should handle deleted files', async () => {
      const changeEvent = new CodeChangeEvent();
      changeEvent.changeType = ChangeType.DELETED;
      changeEvent.repository = 'owner/repo';
      changeEvent.filePath = 'src/test.ts';
      changeEvent.affectedReferences = ['ref1'];

      const codeReference = {
        id: 'ref1',
        markAsDeleted: jest.fn(),
      };

      mockCodeReferenceRepository.findOne.mockResolvedValue(codeReference);
      mockCodeReferenceRepository.save.mockResolvedValue(codeReference);
      mockNotificationService.sendConflictNotification.mockResolvedValue(
        undefined,
      );

      const result = await service.processCodeChange(changeEvent);

      expect(result).toBe(true);
      expect(codeReference.markAsDeleted).toHaveBeenCalled();
      expect(mockCodeReferenceRepository.save).toHaveBeenCalledWith(
        codeReference,
      );
      expect(
        mockNotificationService.sendConflictNotification,
      ).toHaveBeenCalled();
    });

    it('should skip processing if no affected references found', async () => {
      const changeEvent = new CodeChangeEvent();
      changeEvent.affectedReferences = ['ref1'];

      mockCodeReferenceRepository.findOne.mockResolvedValue(null);

      const result = await service.processCodeChange(changeEvent);

      expect(result).toBe(true);
      expect(mockCodeExtractorService.getFileContent).not.toHaveBeenCalled();
    });
  });

  describe('updateCodeReference', () => {
    it('should update reference when content changes', async () => {
      const codeReference = {
        id: 'ref1',
        repository: 'owner/repo',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        filePath: 'test.ts',
        referenceType: 'line',
        startLine: 10,
        endLine: 20,
        functionName: 'testFunction',
        className: null,
        methodName: null,
        content: 'old content',
        contentHash: 'old-hash',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        updateContent: jest.fn(),
        updateLineNumbers: jest.fn(),
        markAsDeleted: jest.fn(),
        isDeleted: jest.fn().mockReturnValue(false),
        calculateContentHash: jest.fn(),
      } as any;
      const fileContent = 'function testFunction() {\n  return "new code";\n}';

      jest
        .spyOn(service, 'extractCodeSnippet')
        .mockReturnValue('new code snippet');
      jest.spyOn(service, 'calculateContentHash').mockReturnValue('new-hash');
      mockCodeReferenceRepository.save.mockResolvedValue(codeReference);
      mockNotificationService.sendChangeNotification.mockResolvedValue(
        undefined,
      );

      await service.updateCodeReference(codeReference, fileContent);

      expect(codeReference.updateContent).toHaveBeenCalledWith(
        'new code snippet',
        'new-hash',
      );
      expect(mockCodeReferenceRepository.save).toHaveBeenCalledWith(
        codeReference,
      );
      expect(mockNotificationService.sendChangeNotification).toHaveBeenCalled();
    });

    it('should handle function-based references', async () => {
      const codeReference = {
        id: 'ref1',
        repository: 'owner/repo',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        filePath: 'test.ts',
        referenceType: 'function',
        startLine: null,
        endLine: null,
        functionName: 'testFunction',
        className: null,
        methodName: null,
        content: 'old content',
        contentHash: 'old-hash',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        updateContent: jest.fn(),
        updateLineNumbers: jest.fn(),
        markAsDeleted: jest.fn(),
        isDeleted: jest.fn().mockReturnValue(false),
        calculateContentHash: jest.fn(),
      } as any;
      const fileContent = 'function testFunction() {\n  return "code";\n}';

      const functionSignature: FunctionSignature = {
        name: 'testFunction',
        parameters: [],
        startLine: 5,
        endLine: 10,
        hash: 'function-hash',
      };

      jest
        .spyOn(service, 'detectFunctionSignature')
        .mockResolvedValue(functionSignature);
      jest
        .spyOn(service, 'extractCodeSnippet')
        .mockReturnValue('function code');
      jest.spyOn(service, 'calculateContentHash').mockReturnValue('new-hash');
      mockCodeReferenceRepository.save.mockResolvedValue(codeReference);

      await service.updateCodeReference(codeReference, fileContent);

      expect(service.detectFunctionSignature).toHaveBeenCalledWith(
        fileContent,
        'testFunction',
      );
      expect(codeReference.updateLineNumbers).toHaveBeenCalledWith(5, 10);
      expect(codeReference.updateContent).toHaveBeenCalledWith(
        'function code',
        'new-hash',
      );
    });

    it('should skip update if content hash is unchanged', async () => {
      const codeReference = {
        id: 'ref1',
        repository: 'owner/repo',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        filePath: 'test.ts',
        referenceType: 'line',
        startLine: 10,
        endLine: 20,
        functionName: null,
        className: null,
        methodName: null,
        content: 'unchanged content',
        contentHash: 'same-hash',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        updateContent: jest.fn(),
        updateLineNumbers: jest.fn(),
        markAsDeleted: jest.fn(),
        isDeleted: jest.fn().mockReturnValue(false),
        calculateContentHash: jest.fn(),
      } as any;
      const fileContent = 'unchanged content';

      jest.spyOn(service, 'extractCodeSnippet').mockReturnValue('code snippet');
      jest.spyOn(service, 'calculateContentHash').mockReturnValue('same-hash');

      await service.updateCodeReference(codeReference, fileContent);

      expect(codeReference.updateContent).not.toHaveBeenCalled();
      expect(mockCodeReferenceRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('detectFunctionSignature', () => {
    it('should detect TypeScript function signature', async () => {
      const fileContent = `
        export class TestClass {
          public testMethod(param1: string, param2: number): boolean {
            return true;
          }
        }
      `;

      const result = await service.detectFunctionSignature(
        fileContent,
        'testMethod',
      );

      expect(result).toEqual({
        name: 'testMethod',
        parameters: ['param1: string', 'param2: number'],
        returnType: 'boolean',
        startLine: 3,
        endLine: 5, // Updated to match actual implementation
        hash: expect.any(String),
      });
    });

    it('should detect JavaScript function signature', async () => {
      const fileContent = `function testFunction(a, b) {
  return a + b;
}`;

      const result = await service.detectFunctionSignature(
        fileContent,
        'testFunction',
      );

      expect(result).toEqual({
        name: 'testFunction',
        parameters: ['a', 'b'],
        startLine: 1,
        endLine: 3,
        hash: expect.any(String),
      });
    });

    it('should return null for non-existent function', async () => {
      const fileContent = 'console.log("no functions here");';

      const result = await service.detectFunctionSignature(
        fileContent,
        'nonExistentFunction',
      );

      expect(result).toBeNull();
    });
  });

  describe('detectLineMovement', () => {
    it('should detect moved code with high confidence', async () => {
      const oldContent = 'const originalCode = "test";';
      const newFileContent = `
        // some new code
        const originalCode = "test";
        // more code
      `;

      const result = await service.detectLineMovement(
        oldContent,
        newFileContent,
      );

      expect(result).toEqual({
        found: true,
        newStartLine: 3,
        newEndLine: 3,
        confidence: expect.any(Number),
        reason: expect.any(String),
      });
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should return not found for deleted code', async () => {
      const oldContent = 'const deletedCode = "gone";';
      const newFileContent = 'console.log("different content");';

      const result = await service.detectLineMovement(
        oldContent,
        newFileContent,
      );

      expect(result).toEqual({
        found: false,
        confidence: 0,
        reason: 'Code not found in new content',
      });
    });

    it('should handle partial matches with lower confidence', async () => {
      const oldContent = 'const partialMatch = "original";';
      const newFileContent = 'const partialMatch = "modified";';

      const result = await service.detectLineMovement(
        oldContent,
        newFileContent,
      );

      expect(result.found).toBe(true);
      expect(result.confidence).toBeLessThan(1.0);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('extractCodeSnippet', () => {
    it('should extract lines correctly', () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      const result = service.extractCodeSnippet(content, 2, 4);
      expect(result).toBe('line2\nline3\nline4');
    });

    it('should handle single line extraction', () => {
      const content = 'line1\nline2\nline3';
      const result = service.extractCodeSnippet(content, 2, 2);
      expect(result).toBe('line2');
    });

    it('should handle out-of-bounds lines gracefully', () => {
      const content = 'line1\nline2';
      const result = service.extractCodeSnippet(content, 1, 5);
      expect(result).toBe('line1\nline2');
    });
  });

  describe('calculateContentHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = 'test content';
      const hash1 = service.calculateContentHash(content);
      const hash2 = service.calculateContentHash(content);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different hashes for different content', () => {
      const hash1 = service.calculateContentHash('content1');
      const hash2 = service.calculateContentHash('content2');
      expect(hash1).not.toBe(hash2);
    });
  });
});
