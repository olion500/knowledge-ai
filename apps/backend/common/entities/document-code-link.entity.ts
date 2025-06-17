import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import { Document } from './document.entity';
import { CodeReference } from './code-reference.entity';
import { GitHubInfo } from '../interfaces/code-reference.interface';

@Entity('document_code_links')
export class DocumentCodeLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, { nullable: false })
  @JoinColumn({ name: 'documentId' })
  @IsNotEmpty()
  document: Document;

  @Column()
  documentId: string;

  @ManyToOne(() => CodeReference, (ref) => ref.documentLinks, {
    nullable: false,
  })
  @JoinColumn({ name: 'codeReferenceId' })
  @IsNotEmpty()
  codeReference: CodeReference;

  @Column()
  codeReferenceId: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  placeholderText: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  context?: string;

  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Business logic methods
  extractGitHubInfo(): GitHubInfo | null {
    // Extract GitHub URL pattern from placeholder text
    // Pattern: [텍스트](github://owner/repo/path/file.ts:10-20)
    // or [텍스트](github://owner/repo/path/file.ts#functionName)
    const githubUrlRegex =
      /\[.*?\]\(github:\/\/([^\/]+)\/([^\/]+)\/(.+?)(?::(\d+)(?:-(\d+))?|#([^)]+))?\)/;
    const match = this.placeholderText.match(githubUrlRegex);

    if (!match) {
      return null;
    }

    const [, owner, repo, filePath, startLineStr, endLineStr, functionName] =
      match;

    const result: GitHubInfo = {
      owner,
      repo,
      filePath,
    };

    if (functionName) {
      result.functionName = functionName;
    } else if (startLineStr) {
      result.startLine = parseInt(startLineStr, 10);
      if (endLineStr) {
        result.endLine = parseInt(endLineStr, 10);
      }
    }

    return result;
  }

  isLinkActive(): boolean {
    return this.isActive;
  }

  generateMarkdownWithSnippet(codeSnippet: string): string {
    // Extract file extension to determine language
    const fileExtension = this.extractFileExtension();
    const language = this.getLanguageFromExtension(fileExtension);

    return `\`\`\`${language}\n${codeSnippet}\n\`\`\``;
  }

  private extractFileExtension(): string {
    const info = this.extractGitHubInfo();
    if (!info) return '';

    const parts = info.filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
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

    return languageMap[extension] || extension || 'text';
  }
}
