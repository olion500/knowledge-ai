import { Injectable, Logger } from '@nestjs/common';
import {
  parse,
  AST_NODE_TYPES,
  TSESTree,
} from '@typescript-eslint/typescript-estree';
import { createHash } from 'crypto';
import {
  CodeAnalysisResult,
  FunctionInfo,
  ClassInfo,
  ParameterInfo,
  PropertyInfo,
  ImportInfo,
  ExportInfo,
  CodeComplexity,
  FileComplexity,
  AnalysisError,
  FingerprintConfig,
  ParserConfig,
} from '../../../common/interfaces/code-analysis.interface';

@Injectable()
export class TypeScriptParser {
  private readonly logger = new Logger(TypeScriptParser.name);

  private readonly defaultFingerprintConfig: FingerprintConfig = {
    includeParameterNames: true,
    includeParameterTypes: true,
    includeReturnType: true,
    includeModifiers: false,
    includeClassName: true,
    caseSensitive: true,
  };

  async analyzeFile(
    filePath: string,
    sourceCode: string,
    config?: Partial<ParserConfig>,
  ): Promise<CodeAnalysisResult> {
    const parserConfig = this.buildParserConfig(config);

    try {
      const ast = parse(sourceCode, {
        loc: true,
        range: true,
        comments: parserConfig.includeComments,
        filePath,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });

      const result: CodeAnalysisResult = {
        filePath,
        language: parserConfig.language,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        complexity: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 0,
          linesOfCode: sourceCode.split('\n').length,
          maintainabilityIndex: 100,
          totalFunctions: 0,
          totalClasses: 0,
          averageFunctionComplexity: 0,
          averageClassComplexity: 0,
        },
        dependencies: [],
        errors: [],
      };

      this.traverseAST(ast, result, sourceCode);
      this.calculateComplexity(result);

      return result;
    } catch (error) {
      this.logger.error(`Failed to parse ${filePath}:`, error);
      throw new Error(`TypeScript parsing failed: ${error.message}`);
    }
  }

  private buildParserConfig(config?: Partial<ParserConfig>): ParserConfig {
    return {
      language: 'typescript',
      version: 'latest',
      strict: false,
      includeComments: true,
      includeDocstrings: true,
      excludePatterns: ['node_modules/**', '**/*.d.ts'],
      ...config,
    };
  }

  private traverseAST(
    node: TSESTree.Node,
    result: CodeAnalysisResult,
    sourceCode: string,
  ): void {
    switch (node.type) {
      case AST_NODE_TYPES.FunctionDeclaration:
      case AST_NODE_TYPES.FunctionExpression:
      case AST_NODE_TYPES.ArrowFunctionExpression:
        if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id) {
          const functionInfo = this.extractFunctionInfo(node, sourceCode);
          result.functions.push(functionInfo);
        }
        break;

      case AST_NODE_TYPES.MethodDefinition:
        const methodInfo = this.extractMethodInfo(node, sourceCode);
        // Methods will be added to classes during class processing
        break;

      case AST_NODE_TYPES.ClassDeclaration:
        const classInfo = this.extractClassInfo(node, sourceCode);
        result.classes.push(classInfo);
        break;

      case AST_NODE_TYPES.ImportDeclaration:
        const importInfo = this.extractImportInfo(node);
        result.imports.push(importInfo);
        break;

      case AST_NODE_TYPES.ExportNamedDeclaration:
      case AST_NODE_TYPES.ExportDefaultDeclaration:
        const exportInfo = this.extractExportInfo(node);
        if (exportInfo) {
          result.exports.push(exportInfo);
        }
        break;
    }

    // Recursively traverse child nodes
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((child) => {
            if (child && typeof child === 'object' && 'type' in child) {
              this.traverseAST(child as TSESTree.Node, result, sourceCode);
            }
          });
        } else if ('type' in value) {
          this.traverseAST(value as TSESTree.Node, result, sourceCode);
        }
      }
    }
  }

  private extractFunctionInfo(
    node:
      | TSESTree.FunctionDeclaration
      | TSESTree.FunctionExpression
      | TSESTree.ArrowFunctionExpression,
    sourceCode: string,
    className?: string,
  ): FunctionInfo {
    const name = this.getFunctionName(node);
    const parameters = this.extractParameters(node.params);
    const startLine = node.loc?.start.line || 0;
    const endLine = node.loc?.end.line || 0;
    const signature = this.buildSignature(name, parameters, node);
    const fingerprint = this.generateFingerprint(signature, className);

    return {
      name,
      signature,
      fingerprint,
      startLine,
      endLine,
      className,
      docstring: this.extractDocstring(node, sourceCode),
      parameters,
      returnType: this.extractReturnType(node),
      decorators: this.extractDecorators(node),
      modifiers: this.extractModifiers(node),
      complexity: this.calculateFunctionComplexity(node, sourceCode),
      dependencies: [],
      isAsync: node.async || false,
      isGenerator: node.generator || false,
      isExported: this.isExported(node),
    };
  }

  private extractMethodInfo(
    node: TSESTree.MethodDefinition,
    sourceCode: string,
  ): FunctionInfo {
    const className = this.getParentClassName(node);
    return this.extractFunctionInfo(node.value as any, sourceCode, className);
  }

  private extractClassInfo(
    node: TSESTree.ClassDeclaration,
    sourceCode: string,
  ): ClassInfo {
    const name = node.id?.name || 'AnonymousClass';
    const startLine = node.loc?.start.line || 0;
    const endLine = node.loc?.end.line || 0;
    const methods: FunctionInfo[] = [];
    const properties: PropertyInfo[] = [];

    // Extract methods and properties
    node.body.body.forEach((member) => {
      if (member.type === AST_NODE_TYPES.MethodDefinition) {
        const method = this.extractMethodInfo(member, sourceCode);
        methods.push(method);
      } else if (member.type === AST_NODE_TYPES.PropertyDefinition) {
        const property = this.extractPropertyInfo(member);
        properties.push(property);
      }
    });

    const signature = this.buildClassSignature(name, node);
    const fingerprint = this.generateFingerprint(signature);

    return {
      name,
      signature,
      fingerprint,
      startLine,
      endLine,
      docstring: this.extractDocstring(node, sourceCode),
      superClass: this.extractSuperClass(node),
      interfaces: this.extractInterfaces(node),
      decorators: this.extractDecorators(node),
      modifiers: this.extractModifiers(node),
      methods,
      properties,
      complexity: this.calculateClassComplexity(methods, properties),
      isExported: this.isExported(node),
    };
  }

  private extractParameters(params: TSESTree.Parameter[]): ParameterInfo[] {
    return params.map((param) => {
      const name = this.getParameterName(param);
      return {
        name,
        type: this.getParameterType(param),
        defaultValue: this.getDefaultValue(param),
        optional: this.isOptionalParameter(param),
        spread: param.type === AST_NODE_TYPES.RestElement,
      };
    });
  }

  private extractPropertyInfo(node: TSESTree.PropertyDefinition): PropertyInfo {
    const name = this.getPropertyName(node);
    return {
      name,
      type: this.getPropertyType(node),
      defaultValue: this.getPropertyDefaultValue(node),
      modifiers: this.extractModifiers(node),
      decorators: this.extractDecorators(node),
      isStatic: Boolean(node.static),
      isReadonly: Boolean(node.readonly),
    };
  }

  private extractImportInfo(node: TSESTree.ImportDeclaration): ImportInfo {
    const source = node.source.value || '';
    const specifiers =
      node.specifiers?.map((spec) => ({
        name: this.getImportSpecifierName(spec),
        alias: this.getImportSpecifierAlias(spec),
        isDefault: spec.type === AST_NODE_TYPES.ImportDefaultSpecifier,
        isNamespace: spec.type === AST_NODE_TYPES.ImportNamespaceSpecifier,
      })) || [];

    return {
      source,
      specifiers,
      isTypeOnly: Boolean((node as any).importKind === 'type'),
    };
  }

  private extractExportInfo(
    node: TSESTree.ExportNamedDeclaration | TSESTree.ExportDefaultDeclaration,
  ): ExportInfo | null {
    if (node.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
      return {
        name: 'default',
        type: this.getExportType(node.declaration),
        isDefault: true,
      };
    } else if (node.declaration) {
      const name = this.getDeclarationName(node.declaration);
      if (name) {
        return {
          name,
          type: this.getExportType(node.declaration),
          isDefault: false,
        };
      }
    }
    return null;
  }

  private generateFingerprint(signature: string, className?: string): string {
    const content = className ? `${className}.${signature}` : signature;
    return createHash('md5').update(content).digest('hex');
  }

  private buildSignature(
    name: string,
    parameters: ParameterInfo[],
    node: any,
  ): string {
    const params = parameters
      .map((p) => {
        let param = p.name;
        if (p.type) param += `: ${p.type}`;
        if (p.optional) param += '?';
        if (p.defaultValue) param += ` = ${p.defaultValue}`;
        return param;
      })
      .join(', ');

    let signature = `${name}(${params})`;
    const returnType = this.extractReturnType(node);
    if (returnType) {
      signature += `: ${returnType}`;
    }

    return signature;
  }

  private buildClassSignature(
    name: string,
    node: TSESTree.ClassDeclaration,
  ): string {
    let signature = `class ${name}`;

    const superClass = this.extractSuperClass(node);
    if (superClass) {
      signature += ` extends ${superClass}`;
    }

    const interfaces = this.extractInterfaces(node);
    if (interfaces.length > 0) {
      signature += ` implements ${interfaces.join(', ')}`;
    }

    return signature;
  }

  private calculateFunctionComplexity(
    node: any,
    sourceCode: string,
  ): CodeComplexity {
    // Simplified complexity calculation
    const lines = sourceCode.split('\n');
    const functionLines = lines.slice(
      (node.loc?.start.line || 1) - 1,
      node.loc?.end.line || lines.length,
    );

    return {
      cyclomaticComplexity: this.calculateCyclomaticComplexity(node),
      cognitiveComplexity: this.calculateCognitiveComplexity(node),
      linesOfCode: functionLines.length,
      maintainabilityIndex: Math.max(
        0,
        171 -
          5.2 * Math.log(functionLines.length) -
          0.23 * this.calculateCyclomaticComplexity(node),
      ),
    };
  }

  private calculateClassComplexity(
    methods: FunctionInfo[],
    properties: PropertyInfo[],
  ): CodeComplexity {
    const avgMethodComplexity =
      methods.length > 0
        ? methods.reduce(
            (sum, m) => sum + m.complexity.cyclomaticComplexity,
            0,
          ) / methods.length
        : 0;

    const totalLOC = methods.reduce(
      (sum, m) => sum + m.complexity.linesOfCode,
      0,
    );

    return {
      cyclomaticComplexity: Math.ceil(avgMethodComplexity),
      cognitiveComplexity: methods.reduce(
        (sum, m) => sum + m.complexity.cognitiveComplexity,
        0,
      ),
      linesOfCode: totalLOC,
      maintainabilityIndex: Math.max(
        0,
        171 -
          5.2 * Math.log(Math.max(1, totalLOC)) -
          0.23 * avgMethodComplexity,
      ),
    };
  }

  private calculateComplexity(result: CodeAnalysisResult): void {
    const complexity = result.complexity;
    complexity.totalFunctions = result.functions.length;
    complexity.totalClasses = result.classes.length;

    if (result.functions.length > 0) {
      complexity.averageFunctionComplexity =
        result.functions.reduce(
          (sum, f) => sum + f.complexity.cyclomaticComplexity,
          0,
        ) / result.functions.length;
    }

    if (result.classes.length > 0) {
      complexity.averageClassComplexity =
        result.classes.reduce(
          (sum, c) => sum + c.complexity.cyclomaticComplexity,
          0,
        ) / result.classes.length;
    }

    complexity.cyclomaticComplexity = Math.max(
      1,
      result.functions.reduce(
        (sum, f) => sum + f.complexity.cyclomaticComplexity,
        1,
      ) +
        result.classes.reduce(
          (sum, c) => sum + c.complexity.cyclomaticComplexity,
          0,
        ),
    );

    complexity.cognitiveComplexity =
      result.functions.reduce(
        (sum, f) => sum + f.complexity.cognitiveComplexity,
        0,
      ) +
      result.classes.reduce(
        (sum, c) => sum + c.complexity.cognitiveComplexity,
        0,
      );
  }

  // Helper methods for extracting information from AST nodes
  private getFunctionName(node: any): string {
    if (node.id?.name) return node.id.name;
    if (node.key?.name) return node.key.name;
    return 'anonymous';
  }

  private getParameterName(param: TSESTree.Parameter): string {
    if (param.type === AST_NODE_TYPES.Identifier) {
      return param.name;
    } else if (param.type === AST_NODE_TYPES.RestElement) {
      return `...${this.getParameterName(param.argument as TSESTree.Parameter)}`;
    }
    return 'unknown';
  }

  private getParameterType(param: TSESTree.Parameter): string | undefined {
    // Simplified type extraction - in a real implementation,
    // you'd want more sophisticated type analysis
    return (param as any).typeAnnotation?.typeAnnotation?.type || undefined;
  }

  private getDefaultValue(param: TSESTree.Parameter): string | undefined {
    return (param as any).defaultValue ? 'default' : undefined;
  }

  private isOptionalParameter(param: TSESTree.Parameter): boolean {
    return Boolean((param as any).optional);
  }

  private extractDocstring(node: any, sourceCode: string): string | undefined {
    // Simplified docstring extraction
    // In a real implementation, you'd parse JSDoc comments
    return undefined;
  }

  private extractReturnType(node: any): string | undefined {
    return node.returnType?.typeAnnotation?.type || undefined;
  }

  private extractDecorators(node: any): string[] {
    return (
      node.decorators?.map((d: any) => d.expression?.name || 'decorator') || []
    );
  }

  private extractModifiers(node: any): string[] {
    const modifiers: string[] = [];
    if (node.static) modifiers.push('static');
    if (node.async) modifiers.push('async');
    if (node.readonly) modifiers.push('readonly');
    if (node.accessibility) modifiers.push(node.accessibility);
    return modifiers;
  }

  private isExported(node: any): boolean {
    // Simplified export detection
    return Boolean(node.export || node.exported);
  }

  private getParentClassName(node: any): string | undefined {
    // This would need to be implemented by tracking parent nodes during traversal
    return undefined;
  }

  private extractSuperClass(
    node: TSESTree.ClassDeclaration,
  ): string | undefined {
    return (node.superClass as any)?.name;
  }

  private extractInterfaces(node: TSESTree.ClassDeclaration): string[] {
    return (
      (node as any).implements?.map(
        (impl: any) => impl.expression?.name || 'interface',
      ) || []
    );
  }

  private getPropertyName(node: TSESTree.PropertyDefinition): string {
    return (node.key as any)?.name || 'unknown';
  }

  private getPropertyType(
    node: TSESTree.PropertyDefinition,
  ): string | undefined {
    return (node as any).typeAnnotation?.typeAnnotation?.type;
  }

  private getPropertyDefaultValue(
    node: TSESTree.PropertyDefinition,
  ): string | undefined {
    return node.value ? 'default' : undefined;
  }

  private getImportSpecifierName(spec: TSESTree.ImportClause): string {
    return (
      (spec as any).imported?.name || (spec as any).local?.name || 'unknown'
    );
  }

  private getImportSpecifierAlias(
    spec: TSESTree.ImportClause,
  ): string | undefined {
    return (spec as any).local?.name !== (spec as any).imported?.name
      ? (spec as any).local?.name
      : undefined;
  }

  private getExportType(
    declaration: any,
  ): 'function' | 'class' | 'variable' | 'type' | 'interface' {
    if (!declaration) return 'variable';

    switch (declaration.type) {
      case AST_NODE_TYPES.FunctionDeclaration:
        return 'function';
      case AST_NODE_TYPES.ClassDeclaration:
        return 'class';
      case AST_NODE_TYPES.TSInterfaceDeclaration:
        return 'interface';
      case AST_NODE_TYPES.TSTypeAliasDeclaration:
        return 'type';
      default:
        return 'variable';
    }
  }

  private getDeclarationName(declaration: any): string | undefined {
    return declaration?.id?.name;
  }

  private calculateCyclomaticComplexity(node: any): number {
    // Simplified cyclomatic complexity calculation
    // In a real implementation, you'd count decision points
    const complexity = 1;

    // This is a basic implementation - you'd want to traverse the AST
    // and count if statements, loops, switch cases, etc.

    return complexity;
  }

  private calculateCognitiveComplexity(node: any): number {
    // Simplified cognitive complexity calculation
    // In a real implementation, you'd implement the cognitive complexity algorithm
    return 0;
  }
}
