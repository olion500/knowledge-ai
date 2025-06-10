import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { CodeStructure } from '../../common/entities/code-structure.entity';
import { CodeChangeLog } from '../../common/entities/code-change-log.entity';
import { Repository } from '../../common/entities/repository.entity';
import { RepositoryService } from '../repository/repository.service';
import { GitHubService } from '../github/github.service';
import { TypeScriptParser } from './parsers/typescript-parser';
import {
  CodeAnalysisResult,
  FunctionInfo,
  ClassInfo,
  CodeStructureComparison,
  CodeChangeAnalysis,
  ParserConfig,
} from '../../common/interfaces/code-analysis.interface';

@Injectable()
export class CodeAnalysisService {
  private readonly logger = new Logger(CodeAnalysisService.name);

  constructor(
    @InjectRepository(CodeStructure)
    private readonly codeStructureRepository: TypeOrmRepository<CodeStructure>,
    @InjectRepository(CodeChangeLog)
    private readonly codeChangeLogRepository: TypeOrmRepository<CodeChangeLog>,
    private readonly repositoryService: RepositoryService,
    private readonly githubService: GitHubService,
    private readonly typescriptParser: TypeScriptParser,
  ) {}

  async analyzeRepository(
    repositoryId: string,
    commitSha?: string,
  ): Promise<{
    totalFiles: number;
    analyzedFiles: number;
    functions: number;
    classes: number;
    errors: string[];
  }> {
    this.logger.log(`Starting analysis for repository ${repositoryId}`);

    try {
      const repository = await this.repositoryService.findOne(repositoryId);
      const targetCommitSha = commitSha || repository.defaultBranch || 'main';

      if (!targetCommitSha) {
        throw new Error('No commit SHA available for analysis');
      }

      // Get all files in the repository
      const files = await this.githubService.getRepositoryContents(
        repository.owner,
        repository.name,
        targetCommitSha,
      );

      const analyzableFiles = files.filter(
        (file) => file.type === 'file' && this.isAnalyzableFile(file.name),
      );

      let analyzedCount = 0;
      let totalFunctions = 0;
      let totalClasses = 0;
      const errors: string[] = [];

      for (const file of analyzableFiles) {
        try {
          await this.analyzeFile(repositoryId, file.path, targetCommitSha);
          analyzedCount++;
        } catch (error) {
          this.logger.error(`Failed to analyze file ${file.path}:`, error);
          errors.push(`${file.path}: ${error.message}`);
        }
      }

      // Count total functions and classes
      const structures = await this.codeStructureRepository.find({
        where: { repositoryId, commitSha: targetCommitSha },
      });

      totalFunctions = structures.filter((s) => !s.className).length;
      totalClasses = structures.filter((s) => s.className).length;

      this.logger.log(
        `Analysis completed for repository ${repositoryId}: ${analyzedCount}/${analyzableFiles.length} files`,
      );

      return {
        totalFiles: analyzableFiles.length,
        analyzedFiles: analyzedCount,
        functions: totalFunctions,
        classes: totalClasses,
        errors,
      };
    } catch (error) {
      this.logger.error(`Failed to analyze repository ${repositoryId}:`, error);
      throw error;
    }
  }

  async analyzeFile(
    repositoryId: string,
    filePath: string,
    commitSha: string,
  ): Promise<CodeAnalysisResult> {
    this.logger.debug(`Analyzing file ${filePath} at commit ${commitSha}`);

    try {
      const repository = await this.repositoryService.findOne(repositoryId);

      // Get file content from GitHub
      const fileContent = await this.githubService.getFileContent(
        filePath,
        commitSha,
      );
      if (!fileContent || !fileContent.content) {
        throw new Error(`File ${filePath} not found`);
      }

      const sourceCode = Buffer.from(fileContent.content, 'base64').toString(
        'utf-8',
      );
      const language = this.detectLanguage(filePath);

      // Parse the file based on language
      const analysisResult = await this.parseFile(
        filePath,
        sourceCode,
        language,
      );

      // Store or update code structures
      await this.storeCodeStructures(repositoryId, analysisResult, commitSha);

      return analysisResult;
    } catch (error) {
      this.logger.error(`Failed to analyze file ${filePath}:`, error);
      throw error;
    }
  }

  async compareCommits(
    repositoryId: string,
    fromCommitSha: string,
    toCommitSha: string,
  ): Promise<CodeStructureComparison> {
    this.logger.log(
      `Comparing commits ${fromCommitSha} -> ${toCommitSha} for repository ${repositoryId}`,
    );

    try {
      // Get code structures for both commits
      const oldStructures = await this.codeStructureRepository.find({
        where: { repositoryId, commitSha: fromCommitSha },
      });

      const newStructures = await this.codeStructureRepository.find({
        where: { repositoryId, commitSha: toCommitSha },
      });

      // Convert to maps for easier comparison
      const oldMap = new Map(
        oldStructures.map((s) => [
          s.fingerprint,
          this.structureToFunctionInfo(s),
        ]),
      );
      const newMap = new Map(
        newStructures.map((s) => [
          s.fingerprint,
          this.structureToFunctionInfo(s),
        ]),
      );

      const comparison: CodeStructureComparison = {
        added: [],
        deleted: [],
        modified: [],
        moved: [],
        renamed: [],
      };

      // Find added functions
      for (const [fingerprint, functionInfo] of newMap) {
        if (!oldMap.has(fingerprint)) {
          comparison.added.push(functionInfo);
        }
      }

      // Find deleted functions
      for (const [fingerprint, functionInfo] of oldMap) {
        if (!newMap.has(fingerprint)) {
          comparison.deleted.push(functionInfo);
        }
      }

      // Find potentially modified, moved, or renamed functions
      await this.findComplexChanges(oldStructures, newStructures, comparison);

      // Log the changes
      await this.logChanges(
        repositoryId,
        fromCommitSha,
        toCommitSha,
        comparison,
      );

      return comparison;
    } catch (error) {
      this.logger.error(`Failed to compare commits:`, error);
      throw error;
    }
  }

  async getRepositoryStructure(
    repositoryId: string,
    commitSha?: string,
  ): Promise<{
    files: Array<{
      filePath: string;
      functions: FunctionInfo[];
      classes: ClassInfo[];
      complexity: any;
    }>;
    summary: {
      totalFiles: number;
      totalFunctions: number;
      totalClasses: number;
      averageComplexity: number;
    };
  }> {
    const repository = await this.repositoryService.findOne(repositoryId);
    const targetCommitSha = commitSha;

    const structures = await this.codeStructureRepository.find({
      where: { repositoryId, commitSha: targetCommitSha },
    });

    // Group by file path
    const fileMap = new Map<string, CodeStructure[]>();
    structures.forEach((structure) => {
      if (!fileMap.has(structure.filePath)) {
        fileMap.set(structure.filePath, []);
      }
      fileMap.get(structure.filePath)!.push(structure);
    });

    const files = Array.from(fileMap.entries()).map(
      ([filePath, structures]) => {
        const functions = structures
          .filter((s) => !s.className)
          .map((s) => this.structureToFunctionInfo(s));

        const classes = structures
          .filter((s) => s.className)
          .map((s) => this.structureToClassInfo(s));

        const avgComplexity =
          structures.length > 0
            ? structures.reduce(
                (sum, s) => sum + (s.metadata?.cyclomaticComplexity || 1),
                0,
              ) / structures.length
            : 0;

        return {
          filePath,
          functions,
          classes,
          complexity: { average: avgComplexity },
        };
      },
    );

    const summary = {
      totalFiles: files.length,
      totalFunctions: structures.filter((s) => !s.className).length,
      totalClasses: structures.filter((s) => s.className).length,
      averageComplexity:
        structures.length > 0
          ? structures.reduce(
              (sum, s) => sum + (s.metadata?.cyclomaticComplexity || 1),
              0,
            ) / structures.length
          : 0,
    };

    return { files, summary };
  }

  async findFunction(
    repositoryId: string,
    functionName: string,
    className?: string,
  ): Promise<CodeStructure[]> {
    const where: any = { repositoryId, functionName, active: true };
    if (className) {
      where.className = className;
    }

    return this.codeStructureRepository.find({ where });
  }

  async getFunctionHistory(
    repositoryId: string,
    functionFingerprint: string,
  ): Promise<CodeChangeLog[]> {
    return this.codeChangeLogRepository.find({
      where: { repositoryId },
      relations: ['codeStructure'],
      order: { createdAt: 'DESC' },
    });
  }

  private async parseFile(
    filePath: string,
    sourceCode: string,
    language: string,
  ): Promise<CodeAnalysisResult> {
    const config: Partial<ParserConfig> = {
      language: language as any,
      includeComments: true,
      includeDocstrings: true,
    };

    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.typescriptParser.analyzeFile(filePath, sourceCode, config);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private async storeCodeStructures(
    repositoryId: string,
    analysisResult: CodeAnalysisResult,
    commitSha: string,
  ): Promise<void> {
    // Remove old structures for this file and commit
    await this.codeStructureRepository.delete({
      repositoryId,
      filePath: analysisResult.filePath,
      commitSha,
    });

    const structures: Partial<CodeStructure>[] = [];

    // Add functions
    analysisResult.functions.forEach((func) => {
      structures.push({
        repositoryId,
        filePath: analysisResult.filePath,
        commitSha,
        functionName: func.name,
        className: func.className,
        signature: func.signature,
        fingerprint: func.fingerprint,
        startLine: func.startLine,
        endLine: func.endLine,
        language: analysisResult.language,
        docstring: func.docstring,
        astData: {
          parameters: func.parameters,
          returnType: func.returnType,
          decorators: func.decorators,
          modifiers: func.modifiers,
          complexity: func.complexity.cyclomaticComplexity,
          dependencies: func.dependencies,
        },
        metadata: {
          linesOfCode: func.complexity.linesOfCode,
          cyclomaticComplexity: func.complexity.cyclomaticComplexity,
          cognitiveComplexity: func.complexity.cognitiveComplexity,
          maintainabilityIndex: func.complexity.maintainabilityIndex,
        },
      });
    });

    // Add class methods
    analysisResult.classes.forEach((cls) => {
      cls.methods.forEach((method) => {
        structures.push({
          repositoryId,
          filePath: analysisResult.filePath,
          commitSha,
          functionName: method.name,
          className: cls.name,
          signature: method.signature,
          fingerprint: method.fingerprint,
          startLine: method.startLine,
          endLine: method.endLine,
          language: analysisResult.language,
          docstring: method.docstring,
          astData: {
            parameters: method.parameters,
            returnType: method.returnType,
            decorators: method.decorators,
            modifiers: method.modifiers,
            complexity: method.complexity.cyclomaticComplexity,
            dependencies: method.dependencies,
          },
          metadata: {
            linesOfCode: method.complexity.linesOfCode,
            cyclomaticComplexity: method.complexity.cyclomaticComplexity,
            cognitiveComplexity: method.complexity.cognitiveComplexity,
            maintainabilityIndex: method.complexity.maintainabilityIndex,
          },
        });
      });
    });

    if (structures.length > 0) {
      await this.codeStructureRepository.save(structures);
    }
  }

  private async findComplexChanges(
    oldStructures: CodeStructure[],
    newStructures: CodeStructure[],
    comparison: CodeStructureComparison,
  ): Promise<void> {
    // This is a simplified implementation
    // A more sophisticated version would use fuzzy matching
    // to detect renamed/moved functions
  }

  private async logChanges(
    repositoryId: string,
    fromCommitSha: string,
    toCommitSha: string,
    comparison: CodeStructureComparison,
  ): Promise<void> {
    const changeLogs: Partial<CodeChangeLog>[] = [];

    // Log added functions
    comparison.added.forEach((func) => {
      changeLogs.push({
        repositoryId,
        fromCommitSha,
        toCommitSha,
        changeType: 'added',
        filePath: 'unknown', // Would need to track this
        functionName: func.name,
        className: func.className,
        changeDetails: {
          newSignature: func.signature,
          newFingerprint: func.fingerprint,
          linesAdded: func.complexity.linesOfCode,
        },
      });
    });

    // Log deleted functions
    comparison.deleted.forEach((func) => {
      changeLogs.push({
        repositoryId,
        fromCommitSha,
        toCommitSha,
        changeType: 'deleted',
        filePath: 'unknown', // Would need to track this
        functionName: func.name,
        className: func.className,
        changeDetails: {
          oldSignature: func.signature,
          oldFingerprint: func.fingerprint,
          linesDeleted: func.complexity.linesOfCode,
        },
      });
    });

    if (changeLogs.length > 0) {
      await this.codeChangeLogRepository.save(changeLogs);
    }
  }

  private structureToFunctionInfo(structure: CodeStructure): FunctionInfo {
    return {
      name: structure.functionName,
      signature: structure.signature,
      fingerprint: structure.fingerprint,
      startLine: structure.startLine,
      endLine: structure.endLine,
      className: structure.className,
      docstring: structure.docstring,
      parameters: (structure.astData?.parameters || []).map((p) => ({
        name: p.name,
        type: p.type,
        defaultValue: p.defaultValue,
        optional: p.optional || false,
        spread: false, // Default value for missing property
      })),
      returnType: structure.astData?.returnType,
      decorators: structure.astData?.decorators || [],
      modifiers: structure.astData?.modifiers || [],
      complexity: {
        cyclomaticComplexity: structure.metadata?.cyclomaticComplexity || 1,
        cognitiveComplexity: structure.metadata?.cognitiveComplexity || 0,
        linesOfCode: structure.metadata?.linesOfCode || 0,
        maintainabilityIndex: structure.metadata?.maintainabilityIndex || 100,
      },
      dependencies: structure.astData?.dependencies || [],
      isAsync: structure.astData?.modifiers?.includes('async') || false,
      isGenerator: false,
      isExported: false,
    };
  }

  private structureToClassInfo(structure: CodeStructure): ClassInfo {
    // This is a simplified implementation
    // In practice, you'd need to aggregate methods for the class
    return {
      name: structure.className || 'Unknown',
      signature: structure.signature,
      fingerprint: structure.fingerprint,
      startLine: structure.startLine,
      endLine: structure.endLine,
      docstring: structure.docstring,
      superClass: undefined,
      interfaces: [],
      decorators: structure.astData?.decorators || [],
      modifiers: structure.astData?.modifiers || [],
      methods: [],
      properties: [],
      complexity: {
        cyclomaticComplexity: structure.metadata?.cyclomaticComplexity || 1,
        cognitiveComplexity: structure.metadata?.cognitiveComplexity || 0,
        linesOfCode: structure.metadata?.linesOfCode || 0,
        maintainabilityIndex: structure.metadata?.maintainabilityIndex || 100,
      },
      isExported: false,
    };
  }

  private isAnalyzableFile(fileName: string): boolean {
    const analyzableExtensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.go',
      '.rs',
    ];
    return analyzableExtensions.some((ext) => fileName.endsWith(ext));
  }

  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'c':
        return 'c';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      default:
        return 'unknown';
    }
  }
}
