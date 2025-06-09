import { validate } from 'class-validator';
import { DocumentCodeLink } from './document-code-link.entity';
import { Document } from './document.entity';
import { CodeReference } from './code-reference.entity';

describe('DocumentCodeLink Entity', () => {
  let documentCodeLink: DocumentCodeLink;
  let mockDocument: Document;
  let mockCodeReference: CodeReference;

  beforeEach(() => {
    documentCodeLink = new DocumentCodeLink();
    mockDocument = new Document();
    mockCodeReference = new CodeReference();
  });

  describe('Validation', () => {
    it('should be valid with all required fields', async () => {
      documentCodeLink.document = mockDocument;
      documentCodeLink.codeReference = mockCodeReference;
      documentCodeLink.placeholderText =
        '[코드 예시](github://owner/repo/file.ts:10)';
      documentCodeLink.context = 'This is example code snippet';
      documentCodeLink.isActive = true;

      const errors = await validate(documentCodeLink);
      expect(errors).toHaveLength(0);
    });

    it('should be invalid without document', async () => {
      documentCodeLink.codeReference = mockCodeReference;
      documentCodeLink.placeholderText =
        '[코드 예시](github://owner/repo/file.ts:10)';

      const errors = await validate(documentCodeLink);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'document')).toBe(true);
    });

    it('should be invalid without codeReference', async () => {
      documentCodeLink.document = mockDocument;
      documentCodeLink.placeholderText =
        '[코드 예시](github://owner/repo/file.ts:10)';

      const errors = await validate(documentCodeLink);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'codeReference')).toBe(
        true,
      );
    });

    it('should be invalid without placeholderText', async () => {
      documentCodeLink.document = mockDocument;
      documentCodeLink.codeReference = mockCodeReference;

      const errors = await validate(documentCodeLink);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'placeholderText')).toBe(
        true,
      );
    });
  });

  describe('BusinessLogic', () => {
    it('should extract GitHub URL pattern from placeholder', () => {
      documentCodeLink.placeholderText =
        '[코드 예시](github://owner/repo/src/file.ts:10-20)';

      const extractedInfo = documentCodeLink.extractGitHubInfo();
      expect(extractedInfo).toEqual({
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/file.ts',
        startLine: 10,
        endLine: 20,
      });
    });

    it('should handle function-based GitHub URL', () => {
      documentCodeLink.placeholderText =
        '[함수 설명](github://owner/repo/src/file.ts#functionName)';

      const extractedInfo = documentCodeLink.extractGitHubInfo();
      expect(extractedInfo).toEqual({
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/file.ts',
        functionName: 'functionName',
      });
    });

    it('should check if link is active', () => {
      documentCodeLink.isActive = true;
      expect(documentCodeLink.isLinkActive()).toBe(true);

      documentCodeLink.isActive = false;
      expect(documentCodeLink.isLinkActive()).toBe(false);
    });

    it('should generate markdown with code snippet', () => {
      documentCodeLink.placeholderText =
        '[코드 예시](github://owner/repo/file.ts:10)';
      const codeSnippet = 'console.log("Hello World");';

      const markdown =
        documentCodeLink.generateMarkdownWithSnippet(codeSnippet);
      expect(markdown).toContain('```typescript');
      expect(markdown).toContain(codeSnippet);
      expect(markdown).toContain('```');
    });
  });
});
