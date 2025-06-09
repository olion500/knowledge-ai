import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { CodeTrackingService } from './code-tracking.service';
import { Document } from '../../common/entities/document.entity';

@Controller('code-tracking')
export class CodeTrackingController {
  private readonly logger = new Logger(CodeTrackingController.name);

  constructor(private readonly codeTrackingService: CodeTrackingService) {}

  @Post('process-document')
  async processDocumentCodeLinks(@Body() document: Document) {
    this.logger.log(`Processing code links for document: ${document.id}`);

    const processedLinks =
      await this.codeTrackingService.processDocumentCodeLinks(document);

    return {
      documentId: document.id,
      processedLinksCount: processedLinks.length,
      processedLinks: processedLinks.map((link) => ({
        id: link.id,
        placeholderText: link.placeholderText,
        context: link.context,
        codeReference: {
          id: link.codeReference.id,
          repositoryOwner: link.codeReference.repositoryOwner,
          repositoryName: link.codeReference.repositoryName,
          filePath: link.codeReference.filePath,
          referenceType: link.codeReference.referenceType,
        },
      })),
    };
  }

  @Post('update-document-snippets')
  async updateDocumentWithCodeSnippets(@Body() document: Document) {
    this.logger.log(`Updating document with code snippets: ${document.id}`);

    const updatedContent =
      await this.codeTrackingService.updateDocumentWithCodeSnippets(document);

    return {
      documentId: document.id,
      originalContent: document.content,
      updatedContent,
    };
  }

  @Get('document/:documentId/references')
  async getCodeReferencesByDocument(@Param('documentId') documentId: string) {
    this.logger.log(`Getting code references for document: ${documentId}`);

    const codeReferences =
      await this.codeTrackingService.getCodeReferencesByDocument(documentId);

    return {
      documentId,
      codeReferencesCount: codeReferences.length,
      codeReferences: codeReferences.map((ref) => ({
        id: ref.id,
        repositoryOwner: ref.repositoryOwner,
        repositoryName: ref.repositoryName,
        filePath: ref.filePath,
        referenceType: ref.referenceType,
        startLine: ref.startLine,
        endLine: ref.endLine,
        functionName: ref.functionName,
        isActive: ref.isActive,
        lastCommitSha: ref.lastCommitSha,
      })),
    };
  }

  @Get('references/active')
  async getActiveCodeReferences() {
    this.logger.log('Getting all active code references');

    const activeReferences =
      await this.codeTrackingService.getActiveCodeReferences();

    return {
      activeReferencesCount: activeReferences.length,
      activeReferences: activeReferences.map((ref) => ({
        id: ref.id,
        repositoryOwner: ref.repositoryOwner,
        repositoryName: ref.repositoryName,
        filePath: ref.filePath,
        referenceType: ref.referenceType,
        startLine: ref.startLine,
        endLine: ref.endLine,
        functionName: ref.functionName,
        lastCommitSha: ref.lastCommitSha,
      })),
    };
  }

  @Post('references/:referenceId/deactivate')
  async deactivateCodeReference(@Param('referenceId') referenceId: string) {
    this.logger.log(`Deactivating code reference: ${referenceId}`);

    await this.codeTrackingService.deactivateCodeReference(referenceId);

    return {
      referenceId,
      status: 'deactivated',
    };
  }
}
