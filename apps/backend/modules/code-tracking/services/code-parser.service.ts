import { Injectable } from '@nestjs/common';
import {
  CodeLinkInfo,
  RepoInfo,
  ReferenceType,
  CodeReferenceValidation,
} from '../../../common/interfaces/code-reference.interface';

@Injectable()
export class CodeParserService {
  private readonly githubLinkPattern =
    /\[([^\]]+)\]\(github:\/\/([^\/]+)\/([^\/]+)\/(.+?)(?::(\d+)(?:-(\d+))?|#([^)]+))?\)/g;

  parseCodeLinks(content: string): CodeLinkInfo[] {
    const links: CodeLinkInfo[] = [];
    const lines = content.split('\n');
    let match: RegExpExecArray | null;

    // Reset regex state
    this.githubLinkPattern.lastIndex = 0;

    while ((match = this.githubLinkPattern.exec(content)) !== null) {
      const [
        fullMatch,
        linkText,
        owner,
        repo,
        filePath,
        startLineStr,
        endLineStr,
        functionName,
      ] = match;

      // Find context (the line before the match)
      const context = this.extractContext(content, match.index);

      const linkInfo: CodeLinkInfo = {
        owner,
        repo,
        filePath,
        originalText: fullMatch,
        context,
        type: this.determineReferenceType(
          startLineStr,
          endLineStr,
          functionName,
        ),
      };

      if (functionName) {
        linkInfo.functionName = functionName;
      } else if (startLineStr) {
        linkInfo.startLine = parseInt(startLineStr, 10);
        if (endLineStr) {
          linkInfo.endLine = parseInt(endLineStr, 10);
        }
      }

      links.push(linkInfo);
    }

    return links;
  }

  extractRepoInfo(url: string): RepoInfo {
    const githubUrlRegex = /^github:\/\/([^\/]+)\/([^\/]+)\/(.+?)(?:[:#{].*)?$/;
    const match = url.match(githubUrlRegex);

    if (!match) {
      throw new Error('Invalid GitHub URL format');
    }

    const [, owner, repo, filePath] = match;

    return {
      owner,
      repo,
      filePath,
    };
  }

  validateCodeReference(ref: CodeReferenceValidation): boolean {
    // Basic required fields
    if (
      !ref.repositoryOwner ||
      !ref.repositoryName ||
      !ref.filePath ||
      !ref.referenceType
    ) {
      return false;
    }

    // Type-specific validation
    switch (ref.referenceType) {
      case 'line':
        return ref.startLine !== undefined && ref.startLine > 0;

      case 'range':
        return (
          ref.startLine !== undefined &&
          ref.endLine !== undefined &&
          ref.startLine > 0 &&
          ref.endLine > 0 &&
          ref.endLine >= ref.startLine
        );

      case 'function':
        return ref.functionName !== undefined && ref.functionName.length > 0;

      default:
        return false;
    }
  }

  private determineReferenceType(
    startLineStr?: string,
    endLineStr?: string,
    functionName?: string,
  ): ReferenceType {
    if (functionName) {
      return 'function';
    } else if (startLineStr && endLineStr) {
      return 'range';
    } else if (startLineStr) {
      return 'line';
    }
    return 'line'; // default fallback
  }

  private extractContext(content: string, matchIndex: number): string {
    // Find the line that contains the match and get the preceding text
    const beforeMatch = content.substring(0, matchIndex);
    const lines = beforeMatch.split('\n');

    // Get the last few words before the match as context
    const currentLine = lines[lines.length - 1];
    const previousLine = lines.length > 1 ? lines[lines.length - 2] : '';

    // Return the most relevant context
    if (currentLine.trim().length > 0) {
      return currentLine.trim();
    } else if (previousLine.trim().length > 0) {
      return previousLine.trim();
    }

    return '';
  }
}
