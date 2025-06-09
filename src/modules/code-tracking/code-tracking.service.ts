import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CodeReference } from '../../common/entities/code-reference.entity';
import { DocumentCodeLink } from '../../common/entities/document-code-link.entity';
import { Document } from '../../common/entities/document.entity';
import { CodeParserService } from './services/code-parser.service';
import { CodeExtractorService } from './services/code-extractor.service';

@Injectable()
export class CodeTrackingService {
  private readonly logger = new Logger(CodeTrackingService.name);

  constructor(
    @InjectRepository(CodeReference)
    private readonly codeReferenceRepository: Repository<CodeReference>,
    @InjectRepository(DocumentCodeLink)
    private readonly documentCodeLinkRepository: Repository<DocumentCodeLink>,
    private readonly codeParserService: CodeParserService,
    private readonly codeExtractorService: CodeExtractorService,
  ) {}

  async processDocumentCodeLinks(
    document: Document,
  ): Promise<DocumentCodeLink[]> {
    this.logger.log(`Processing code links for document: ${document.id}`);

    // Parse code links from document content
    const codeLinks = this.codeParserService.parseCodeLinks(document.content);

    if (codeLinks.length === 0) {
      this.logger.log(`No code links found in document: ${document.id}`);
      return [];
    }

    this.logger.log(
      `Found ${codeLinks.length} code links in document: ${document.id}`,
    );

    const processedLinks: DocumentCodeLink[] = [];

    for (const codeLink of codeLinks) {
      try {
        // Extract code from GitHub
        let extractedCode;
        let codeReference: Partial<CodeReference>;

        if (codeLink.type === 'function') {
          extractedCode =
            await this.codeExtractorService.extractFunctionBasedCode(
              codeLink.owner,
              codeLink.repo,
              codeLink.filePath,
              codeLink.functionName!,
            );

          codeReference = {
            repositoryOwner: codeLink.owner,
            repositoryName: codeLink.repo,
            filePath: codeLink.filePath,
            referenceType: 'function',
            functionName: codeLink.functionName,
            startLine: extractedCode.startLine,
            endLine: extractedCode.endLine,
            content: extractedCode.content,
            lastCommitSha: extractedCode.sha,
            isActive: true,
          };
        } else {
          // Handle line and range types
          extractedCode = await this.codeExtractorService.extractLineBasedCode(
            codeLink.owner,
            codeLink.repo,
            codeLink.filePath,
            codeLink.startLine!,
            codeLink.endLine,
          );

          codeReference = {
            repositoryOwner: codeLink.owner,
            repositoryName: codeLink.repo,
            filePath: codeLink.filePath,
            referenceType: codeLink.type,
            startLine: codeLink.startLine,
            endLine: codeLink.endLine,
            content: extractedCode.content,
            lastCommitSha: extractedCode.sha,
            isActive: true,
          };
        }

        // Create and save code reference
        const codeReferenceEntity =
          this.codeReferenceRepository.create(codeReference);
        codeReferenceEntity.generateHash();
        const savedCodeReference =
          await this.codeReferenceRepository.save(codeReferenceEntity);

        // Create and save document code link
        const documentCodeLink = this.documentCodeLinkRepository.create({
          document,
          documentId: document.id,
          codeReference: savedCodeReference,
          codeReferenceId: savedCodeReference.id,
          placeholderText: codeLink.originalText,
          context: codeLink.context,
          isActive: true,
        });

        const savedDocumentCodeLink =
          await this.documentCodeLinkRepository.save(documentCodeLink);
        processedLinks.push(savedDocumentCodeLink);

        this.logger.log(
          `Successfully processed code link: ${codeLink.originalText}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process code link: ${codeLink.originalText}`,
          error,
        );
        // Continue processing other links even if one fails
      }
    }

    this.logger.log(
      `Successfully processed ${processedLinks.length} out of ${codeLinks.length} code links`,
    );
    return processedLinks;
  }

  async updateDocumentWithCodeSnippets(document: Document): Promise<string> {
    this.logger.log(`Updating document with code snippets: ${document.id}`);

    // Get all code links for this document
    const documentCodeLinks = await this.documentCodeLinkRepository.find({
      where: { documentId: document.id },
      relations: ['codeReference'],
    });

    if (documentCodeLinks.length === 0) {
      this.logger.log(`No code links found for document: ${document.id}`);
      return document.content;
    }

    let updatedContent = document.content;

    // Replace each code link with actual code snippet
    for (const link of documentCodeLinks) {
      if (link.isActive && link.codeReference.isActive) {
        const codeSnippet = link.generateMarkdownWithSnippet(
          link.codeReference.content,
        );
        updatedContent = updatedContent.replace(
          link.placeholderText,
          codeSnippet,
        );
      }
    }

    this.logger.log(
      `Updated document content with ${documentCodeLinks.length} code snippets`,
    );
    return updatedContent;
  }

  async getCodeReferencesByDocument(
    documentId: string,
  ): Promise<CodeReference[]> {
    const documentCodeLinks = await this.documentCodeLinkRepository.find({
      where: { documentId },
      relations: ['codeReference'],
    });

    return documentCodeLinks.map((link) => link.codeReference);
  }

  async getActiveCodeReferences(): Promise<CodeReference[]> {
    return this.codeReferenceRepository.find({
      where: { isActive: true },
    });
  }

  async deactivateCodeReference(codeReferenceId: string): Promise<void> {
    await this.codeReferenceRepository.update(codeReferenceId, {
      isActive: false,
    });

    // Also deactivate related document links
    await this.documentCodeLinkRepository.update(
      { codeReferenceId },
      { isActive: false },
    );

    this.logger.log(`Deactivated code reference: ${codeReferenceId}`);
  }

  async findCodeReferenceBySignature(
    owner: string,
    repo: string,
    filePath: string,
    referenceType: string,
    startLine?: number,
    endLine?: number,
    functionName?: string,
  ): Promise<CodeReference | null> {
    const whereCondition: any = {
      repositoryOwner: owner,
      repositoryName: repo,
      filePath,
      referenceType,
      isActive: true,
    };

    if (referenceType === 'function' && functionName) {
      whereCondition.functionName = functionName;
    } else if (startLine) {
      whereCondition.startLine = startLine;
      if (endLine) {
        whereCondition.endLine = endLine;
      }
    }

    return this.codeReferenceRepository.findOne({ where: whereCondition });
  }
}
