import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CodeTrackingService } from './code-tracking.service';
import { CodeParserService } from './services/code-parser.service';
import { CodeExtractorService } from './services/code-extractor.service';
import { CodeReference } from '../../common/entities/code-reference.entity';
import { DocumentCodeLink } from '../../common/entities/document-code-link.entity';
import { Document } from '../../common/entities/document.entity';

describe('CodeTrackingService', () => {
  let service: CodeTrackingService;
  let codeParserService: CodeParserService;
  let codeExtractorService: CodeExtractorService;

  const mockCodeReferenceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockDocumentCodeLinkRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockCodeParserService = {
    parseCodeLinks: jest.fn(),
    validateCodeReference: jest.fn(),
  };

  const mockCodeExtractorService = {
    extractLineBasedCode: jest.fn(),
    extractFunctionBasedCode: jest.fn(),
    getFileLanguage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeTrackingService,
        {
          provide: getRepositoryToken(CodeReference),
          useValue: mockCodeReferenceRepository,
        },
        {
          provide: getRepositoryToken(DocumentCodeLink),
          useValue: mockDocumentCodeLinkRepository,
        },
        {
          provide: CodeParserService,
          useValue: mockCodeParserService,
        },
        {
          provide: CodeExtractorService,
          useValue: mockCodeExtractorService,
        },
      ],
    }).compile();

    service = module.get<CodeTrackingService>(CodeTrackingService);
    codeParserService = module.get<CodeParserService>(CodeParserService);
    codeExtractorService =
      module.get<CodeExtractorService>(CodeExtractorService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processDocumentCodeLinks', () => {
    it('should process line-based code links', async () => {
      const mockDocument = {
        id: 'doc-1',
        content: `# Test Document

이것은 예시 코드입니다:
[코드 예시](github://owner/repo/src/file.ts:10-15)

다른 내용...`,
      } as Document;

      const mockCodeLinks = [
        {
          type: 'range' as const,
          owner: 'owner',
          repo: 'repo',
          filePath: 'src/file.ts',
          startLine: 10,
          endLine: 15,
          originalText: '[코드 예시](github://owner/repo/src/file.ts:10-15)',
          context: '이것은 예시 코드입니다:',
        },
      ];

      const mockExtractedCode = {
        content: 'function test() {\n  return true;\n}',
        lineNumbers: [10, 11, 12, 13, 14, 15],
        totalLines: 100,
        sha: 'abc123',
      };

      const mockCodeReference = {
        id: 'ref-1',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        filePath: 'src/file.ts',
        referenceType: 'range',
        startLine: 10,
        endLine: 15,
        content: 'function test() {\n  return true;\n}',
        hash: 'hash123',
  
        isActive: true,
        generateHash: jest.fn(),
      };

      mockCodeParserService.parseCodeLinks.mockReturnValue(mockCodeLinks);
      mockCodeExtractorService.extractLineBasedCode.mockResolvedValue(
        mockExtractedCode,
      );
      mockCodeReferenceRepository.create.mockReturnValue(mockCodeReference);
      mockCodeReferenceRepository.save.mockResolvedValue(mockCodeReference);
      mockDocumentCodeLinkRepository.create.mockReturnValue({});
      mockDocumentCodeLinkRepository.save.mockResolvedValue({});

      const result = await service.processDocumentCodeLinks(mockDocument);

      expect(mockCodeParserService.parseCodeLinks).toHaveBeenCalledWith(
        mockDocument.content,
      );
      expect(
        mockCodeExtractorService.extractLineBasedCode,
      ).toHaveBeenCalledWith('owner', 'repo', 'src/file.ts', 10, 15);
      expect(mockCodeReferenceRepository.save).toHaveBeenCalled();
      expect(mockDocumentCodeLinkRepository.save).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should process function-based code links', async () => {
      const mockDocument = {
        id: 'doc-2',
        content: `# API Documentation

이 함수는 인증을 처리합니다:
[authenticateUser](github://owner/repo/src/auth.service.ts#authenticateUser)`,
      } as Document;

      const mockCodeLinks = [
        {
          type: 'function' as const,
          owner: 'owner',
          repo: 'repo',
          filePath: 'src/auth.service.ts',
          functionName: 'authenticateUser',
          originalText:
            '[authenticateUser](github://owner/repo/src/auth.service.ts#authenticateUser)',
          context: '이 함수는 인증을 처리합니다:',
        },
      ];

      const mockExtractedCode = {
        content:
          'public authenticateUser(token: string) {\n  return this.verify(token);\n}',
        functionName: 'authenticateUser',
        startLine: 25,
        endLine: 27,
        sha: 'def456',
      };

      const mockCodeReference = {
        id: 'ref-2',
        generateHash: jest.fn(),
      };

      mockCodeParserService.parseCodeLinks.mockReturnValue(mockCodeLinks);
      mockCodeExtractorService.extractFunctionBasedCode.mockResolvedValue(
        mockExtractedCode,
      );
      mockCodeReferenceRepository.create.mockReturnValue(mockCodeReference);
      mockCodeReferenceRepository.save.mockResolvedValue(mockCodeReference);
      mockDocumentCodeLinkRepository.create.mockReturnValue({});
      mockDocumentCodeLinkRepository.save.mockResolvedValue({});

      const result = await service.processDocumentCodeLinks(mockDocument);

      expect(
        mockCodeExtractorService.extractFunctionBasedCode,
      ).toHaveBeenCalledWith(
        'owner',
        'repo',
        'src/auth.service.ts',
        'authenticateUser',
      );
      expect(result).toHaveLength(1);
    });

    it('should handle documents without code links', async () => {
      const mockDocument = {
        id: 'doc-3',
        content: `# Regular Document

This is a regular document without any code links.
[Regular link](https://example.com)`,
      } as Document;

      mockCodeParserService.parseCodeLinks.mockReturnValue([]);

      const result = await service.processDocumentCodeLinks(mockDocument);

      expect(result).toHaveLength(0);
      expect(
        mockCodeExtractorService.extractLineBasedCode,
      ).not.toHaveBeenCalled();
      expect(
        mockCodeExtractorService.extractFunctionBasedCode,
      ).not.toHaveBeenCalled();
    });

    it('should handle extraction errors gracefully', async () => {
      const mockDocument = {
        id: 'doc-4',
        content: `[broken link](github://owner/repo/nonexistent.ts:1)`,
      } as Document;

      const mockCodeLinks = [
        {
          type: 'line' as const,
          owner: 'owner',
          repo: 'repo',
          filePath: 'nonexistent.ts',
          startLine: 1,
          originalText: '[broken link](github://owner/repo/nonexistent.ts:1)',
          context: '',
        },
      ];

      mockCodeParserService.parseCodeLinks.mockReturnValue(mockCodeLinks);
      mockCodeExtractorService.extractLineBasedCode.mockRejectedValue(
        new Error('File not found'),
      );

      const result = await service.processDocumentCodeLinks(mockDocument);

      expect(result).toHaveLength(0);
      expect(mockCodeReferenceRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateDocumentWithCodeSnippets', () => {
    it('should replace code links with actual code snippets', async () => {
      const mockDocument = {
        id: 'doc-1',
        content: `# Test Document

이것은 예시 코드입니다:
[코드 예시](github://owner/repo/src/file.ts:10-15)

다른 내용...`,
      } as Document;

      const mockDocumentCodeLinks = [
        {
          id: 'link-1',
          placeholderText: '[코드 예시](github://owner/repo/src/file.ts:10-15)',
          isActive: true,
          codeReference: {
            content: 'function test() {\n  return true;\n}',
            filePath: 'src/file.ts',
            isActive: true,
          },
          generateMarkdownWithSnippet: jest
            .fn()
            .mockReturnValue(
              '```typescript\nfunction test() {\n  return true;\n}\n```',
            ),
        },
      ];

      mockDocumentCodeLinkRepository.find.mockResolvedValue(
        mockDocumentCodeLinks,
      );

      const result = await service.updateDocumentWithCodeSnippets(mockDocument);

      expect(result).toContain(
        '```typescript\nfunction test() {\n  return true;\n}\n```',
      );
      expect(result).not.toContain(
        '[코드 예시](github://owner/repo/src/file.ts:10-15)',
      );
    });
  });

  describe('getCodeReferencesByDocument', () => {
    it('should return code references for a document', async () => {
      const documentId = 'doc-1';
      const mockCodeReferences = [
        {
          id: 'ref-1',
          repositoryOwner: 'owner',
          repositoryName: 'repo',
          filePath: 'src/file.ts',
          isActive: true,
        },
      ];

      mockDocumentCodeLinkRepository.find.mockResolvedValue([
        { codeReference: mockCodeReferences[0] },
      ]);

      const result = await service.getCodeReferencesByDocument(documentId);

      expect(mockDocumentCodeLinkRepository.find).toHaveBeenCalledWith({
        where: { documentId },
        relations: ['codeReference'],
      });
      expect(result).toHaveLength(1);
    });
  });
});
