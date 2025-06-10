import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { CodeChangeEvent, ChangeType } from '../../../common/entities/code-change-event.entity';
import { CodeReference } from '../../../common/entities/code-reference.entity';
import { CodeExtractorService } from './code-extractor.service';
import { NotificationService } from './notification.service';
import { FunctionSignature, CodeMovementResult } from '../../../common/interfaces/code-tracking.interface';

@Injectable()
export class SmartCodeTrackingService {
  private readonly logger = new Logger(SmartCodeTrackingService.name);

  constructor(
    @InjectRepository(CodeReference)
    private readonly codeReferenceRepository: Repository<CodeReference>,
    private readonly codeExtractorService: CodeExtractorService,
    private readonly notificationService: NotificationService,
  ) {}

  async processCodeChange(changeEvent: CodeChangeEvent): Promise<boolean> {
    this.logger.log(`Processing code change event: ${changeEvent.id}`);

    try {
      // Process each affected reference
      for (const referenceId of changeEvent.affectedReferences) {
        const codeReference = await this.codeReferenceRepository.findOne({
          where: { id: referenceId },
        });

        if (!codeReference) {
          this.logger.warn(`Code reference not found: ${referenceId}`);
          continue;
        }

        await this.processReferenceChange(codeReference, changeEvent);
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to process code change:', error);
      throw error;
    }
  }

  private async processReferenceChange(
    codeReference: CodeReference,
    changeEvent: CodeChangeEvent,
  ): Promise<void> {
    switch (changeEvent.changeType) {
      case ChangeType.DELETED:
        await this.handleDeletedFile(codeReference);
        break;
      case ChangeType.MODIFIED:
      case ChangeType.MOVED:
      case ChangeType.RENAMED:
        await this.handleModifiedFile(codeReference, changeEvent);
        break;
    }
  }

  private async handleDeletedFile(codeReference: CodeReference): Promise<void> {
    this.logger.log(`Handling deleted file for reference: ${codeReference.id}`);
    
    codeReference.markAsDeleted();
    await this.codeReferenceRepository.save(codeReference);
    
    await this.notificationService.sendConflictNotification({
      documentId: '', // This would come from document-code-link relationship
      referenceId: codeReference.id,
      changeType: 'deleted',
      oldContent: codeReference.content,
      conflictResolution: {
        referenceId: codeReference.id,
        conflictType: 'deleted',
        resolution: 'manual',
      },
    });
  }

  private async handleModifiedFile(
    codeReference: CodeReference,
    changeEvent: CodeChangeEvent,
  ): Promise<void> {
    this.logger.log(`Handling modified file for reference: ${codeReference.id}`);

    try {
      const repository = `${codeReference.repositoryOwner}/${codeReference.repositoryName}`;
      const fileContent = await this.codeExtractorService.getFileContent(
        repository,
        codeReference.filePath,
      );

      await this.updateCodeReference(codeReference, fileContent);
    } catch (error) {
      this.logger.error(`Failed to get file content for ${codeReference.filePath}:`, error);
      throw error;
    }
  }

  async updateCodeReference(codeReference: CodeReference, fileContent: string): Promise<void> {
    let newContent: string;
    let newStartLine = codeReference.startLine;
    let newEndLine = codeReference.endLine;

    // Handle function-based references
    if (codeReference.functionName && !codeReference.startLine) {
      const functionSignature = await this.detectFunctionSignature(
        fileContent,
        codeReference.functionName,
      );

      if (!functionSignature) {
        this.logger.warn(`Function ${codeReference.functionName} not found in updated file`);
        return;
      }

      newStartLine = functionSignature.startLine;
      newEndLine = functionSignature.endLine;
      codeReference.updateLineNumbers(newStartLine, newEndLine);
    }

    // Extract the current code snippet
    if (newStartLine && newEndLine) {
      newContent = this.extractCodeSnippet(fileContent, newStartLine, newEndLine);
    } else {
      throw new Error('Invalid line numbers for code extraction');
    }
    const newContentHash = this.calculateContentHash(newContent);

    // Check if content has actually changed
    if (newContentHash === codeReference.contentHash) {
      this.logger.log(`No content change detected for reference: ${codeReference.id}`);
      return;
    }

    // Handle line movement detection if content changed
    if (codeReference.content && newContent !== codeReference.content) {
      const movementResult = await this.detectLineMovement(
        codeReference.content,
        fileContent,
      );

              if (movementResult.found && movementResult.confidence > 0.8) {
          this.logger.log(`Detected line movement for reference: ${codeReference.id}`);
          if (movementResult.newStartLine && movementResult.newEndLine) {
            newStartLine = movementResult.newStartLine;
            newEndLine = movementResult.newEndLine;
            newContent = this.extractCodeSnippet(fileContent, movementResult.newStartLine, movementResult.newEndLine);
            codeReference.updateLineNumbers(newStartLine, newEndLine);
          }
        }
    }

    // Update the reference
    codeReference.updateContent(newContent, newContentHash);
    await this.codeReferenceRepository.save(codeReference);

    // Send notification about the change
    await this.notificationService.sendChangeNotification({
      documentId: '', // This would come from document-code-link relationship
      referenceId: codeReference.id,
      changeType: 'modified',
      oldContent: codeReference.content,
      newContent: newContent,
    });

    this.logger.log(`Updated code reference: ${codeReference.id}`);
  }

  async detectFunctionSignature(fileContent: string, functionName: string): Promise<FunctionSignature | null> {
    const lines = fileContent.split('\n');
    let startLine = -1;
    let endLine = -1;
    let braceCount = 0;
    let inFunction = false;
    let parameters: string[] = [];
    let returnType: string | undefined;

    // Regex patterns for different function declarations
    const patterns = [
      // TypeScript/JavaScript functions
      new RegExp(`function\\s+${functionName}\\s*\\(([^)]*)\\)(?:\\s*:\\s*([^{]+))?\\s*{`, 'g'),
      // TypeScript class methods
      new RegExp(`(?:public|private|protected|static)?\\s*${functionName}\\s*\\(([^)]*)\\)(?:\\s*:\\s*([^{]+))?\\s*{`, 'g'),
      // Arrow functions
      new RegExp(`const\\s+${functionName}\\s*=\\s*\\(([^)]*)\\)(?:\\s*:\\s*([^=]+))?\\s*=>`, 'g'),
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of patterns) {
        pattern.lastIndex = 0; // Reset regex lastIndex
        const match = pattern.exec(line);
        if (match) {
          startLine = i + 1; // 1-indexed
          parameters = match[1] ? match[1].split(',').map(p => p.trim()).filter(p => p) : [];
          returnType = match[2] ? match[2].trim() : undefined;
          inFunction = true;
          
          // Count braces in the current line to get initial count
          const openBraces = (line.match(/\{/g) || []).length;
          const closeBraces = (line.match(/\}/g) || []).length;
          braceCount = openBraces - closeBraces;
          break;
        }
      }

      if (inFunction) {
        // If we just started, skip the brace counting as we already did it above
        if (i + 1 !== startLine) {
          // Count braces to find function end
          const openBraces = (line.match(/\{/g) || []).length;
          const closeBraces = (line.match(/\}/g) || []).length;
          braceCount += openBraces - closeBraces;
        }

        if (braceCount === 0) {
          endLine = i + 1; // 1-indexed
          break;
        }
      }
    }

    if (startLine === -1 || endLine === -1) {
      return null;
    }

    const functionContent = this.extractCodeSnippet(fileContent, startLine, endLine);
    const hash = this.calculateContentHash(functionContent);

    return {
      name: functionName,
      parameters,
      returnType,
      startLine,
      endLine,
      hash,
    };
  }

  async detectLineMovement(oldContent: string, newFileContent: string): Promise<CodeMovementResult> {
    const lines = newFileContent.split('\n');
    const oldContentTrimmed = oldContent.trim();

    // Look for exact match first
    for (let i = 0; i < lines.length; i++) {
      const potentialMatch = this.extractCodeSnippet(
        newFileContent,
        i + 1,
        i + oldContent.split('\n').length,
      ).trim();

      if (potentialMatch === oldContentTrimmed) {
        return {
          found: true,
          newStartLine: i + 1,
          newEndLine: i + oldContent.split('\n').length,
          confidence: 1.0,
          reason: 'Exact match found',
        };
      }
    }

    // Look for fuzzy matches
    let bestMatch = { line: -1, confidence: 0 };
    
    for (let i = 0; i < lines.length; i++) {
      const potentialMatch = this.extractCodeSnippet(
        newFileContent,
        i + 1,
        i + oldContent.split('\n').length,
      ).trim();

      const confidence = this.calculateSimilarity(oldContentTrimmed, potentialMatch);
      
      if (confidence > bestMatch.confidence && confidence > 0.5) {
        bestMatch = { line: i + 1, confidence };
      }
    }

    if (bestMatch.line > 0) {
      return {
        found: true,
        newStartLine: bestMatch.line,
        newEndLine: bestMatch.line + oldContent.split('\n').length - 1,
        confidence: bestMatch.confidence,
        reason: `Fuzzy match with ${Math.round(bestMatch.confidence * 100)}% confidence`,
      };
    }

    return {
      found: false,
      confidence: 0,
      reason: 'Code not found in new content',
    };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + cost, // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  extractCodeSnippet(content: string, startLine: number, endLine: number): string {
    const lines = content.split('\n');
    const start = Math.max(0, startLine - 1); // Convert to 0-indexed
    const end = Math.min(lines.length, endLine); // Inclusive end
    
    return lines.slice(start, end).join('\n');
  }

  calculateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }
} 