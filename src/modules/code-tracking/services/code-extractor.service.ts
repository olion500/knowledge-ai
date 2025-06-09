import { Injectable, Logger } from '@nestjs/common';
import { GitHubService } from '../../github/github.service';
import {
  LineBasedCodeResult,
  FunctionBasedCodeResult,
} from '../../../common/interfaces/code-reference.interface';

@Injectable()
export class CodeExtractorService {
  private readonly logger = new Logger(CodeExtractorService.name);

  constructor(private readonly gitHubService: GitHubService) {}

  async extractLineBasedCode(
    owner: string,
    repo: string,
    filePath: string,
    startLine: number,
    endLine?: number,
  ): Promise<LineBasedCodeResult> {
    const fileContent = await this.gitHubService.getFileContent(filePath);

    if (!fileContent) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = Buffer.from(fileContent.content || '', 'base64').toString(
      'utf-8',
    );
    const lines = content.split('\n');

    const actualEndLine = endLine || startLine;

    // Validate line numbers
    if (startLine > lines.length || actualEndLine > lines.length) {
      throw new Error(
        `Line number ${Math.max(startLine, actualEndLine)} is out of range (file has ${lines.length} lines)`,
      );
    }

    if (startLine < 1 || actualEndLine < 1) {
      throw new Error('Line numbers must be greater than 0');
    }

    if (startLine > actualEndLine) {
      throw new Error('Start line must be less than or equal to end line');
    }

    // Extract lines (convert to 0-based index)
    const extractedLines = lines.slice(startLine - 1, actualEndLine);
    const lineNumbers: number[] = [];
    for (let i = startLine; i <= actualEndLine; i++) {
      lineNumbers.push(i);
    }

    return {
      content: extractedLines.join('\n'),
      lineNumbers,
      totalLines: lines.length,
      sha: fileContent.sha,
    };
  }

  async extractFunctionBasedCode(
    owner: string,
    repo: string,
    filePath: string,
    functionName: string,
  ): Promise<FunctionBasedCodeResult> {
    const fileContent = await this.gitHubService.getFileContent(filePath);

    if (!fileContent) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = Buffer.from(fileContent.content || '', 'base64').toString(
      'utf-8',
    );
    const lines = content.split('\n');

    const functionLocation = this.findFunctionInCode(lines, functionName);

    if (!functionLocation) {
      throw new Error(
        `Function "${functionName}" not found in file ${filePath}`,
      );
    }

    const extractedLines = lines.slice(
      functionLocation.startLine - 1,
      functionLocation.endLine,
    );

    return {
      content: extractedLines.join('\n'),
      functionName,
      startLine: functionLocation.startLine,
      endLine: functionLocation.endLine,
      sha: fileContent.sha,
    };
  }

  getFileLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();

    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
      scala: 'scala',
      kt: 'kotlin',
      swift: 'swift',
    };

    return languageMap[extension || ''] || 'text';
  }

  private findFunctionInCode(
    lines: string[],
    functionName: string,
  ): { startLine: number; endLine: number } | null {
    // Handle class method notation (e.g., "ClassName.methodName")
    const parts = functionName.split('.');
    const isClassMethod = parts.length === 2;
    const className = isClassMethod ? parts[0] : null;
    const methodName = isClassMethod ? parts[1] : functionName;

    let inTargetClass = !isClassMethod; // If not a class method, we're always "in the target class"
    let functionStartLine = -1;
    let braceCount = 0;
    let foundFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Check for class declaration if we're looking for a class method
      if (isClassMethod && !inTargetClass) {
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch && classMatch[1] === className) {
          inTargetClass = true;
        }
        continue;
      }

      // Look for function/method declaration
      if (inTargetClass && !foundFunction) {
        const functionPatterns = [
          new RegExp(`\\bfunction\\s+${methodName}\\s*\\(`),
          new RegExp(`\\b(export\\s+)?function\\s+${methodName}\\s*\\(`),
          new RegExp(
            `\\b(public|private|protected|static)?\\s*${methodName}\\s*\\(`,
          ),
          new RegExp(`\\b${methodName}\\s*:\\s*\\(`),
          new RegExp(`\\b${methodName}\\s*=\\s*(function|\\()`),
        ];

        const matchesFunction = functionPatterns.some((pattern) =>
          pattern.test(line),
        );

        if (matchesFunction) {
          functionStartLine = lineNumber;
          foundFunction = true;

          // Count opening braces on this line
          const openBraces = (line.match(/{/g) || []).length;
          const closeBraces = (line.match(/}/g) || []).length;
          braceCount = openBraces - closeBraces;

          // If this is a single-line function (arrow function, etc.), return immediately
          if (braceCount === 0 && (line.includes('=>') || line.endsWith(';'))) {
            return { startLine: functionStartLine, endLine: lineNumber };
          }

          // If we already have balanced braces on the same line, function ends here
          if (braceCount === 0 && openBraces > 0) {
            return { startLine: functionStartLine, endLine: lineNumber };
          }

          continue;
        }
      }

      // Track braces to find function end
      if (foundFunction && functionStartLine > 0) {
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        braceCount += openBraces - closeBraces;

        // Function ends when braces are balanced
        if (braceCount === 0) {
          return { startLine: functionStartLine, endLine: lineNumber };
        }
      }
    }

    return null;
  }
}
