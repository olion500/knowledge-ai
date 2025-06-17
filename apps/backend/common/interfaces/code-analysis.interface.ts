export interface CodeAnalysisResult {
  filePath: string;
  language: string;
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  complexity: FileComplexity;
  dependencies: string[];
  errors: AnalysisError[];
}

export interface FunctionInfo {
  name: string;
  signature: string;
  fingerprint: string;
  startLine: number;
  endLine: number;
  className?: string;
  docstring?: string;
  parameters: ParameterInfo[];
  returnType?: string;
  decorators: string[];
  modifiers: string[];
  complexity: CodeComplexity;
  dependencies: string[];
  isAsync: boolean;
  isGenerator: boolean;
  isExported: boolean;
}

export interface ClassInfo {
  name: string;
  signature: string;
  fingerprint: string;
  startLine: number;
  endLine: number;
  docstring?: string;
  superClass?: string;
  interfaces: string[];
  decorators: string[];
  modifiers: string[];
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  complexity: CodeComplexity;
  isExported: boolean;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  defaultValue?: string;
  optional: boolean;
  spread: boolean;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  defaultValue?: string;
  modifiers: string[];
  decorators: string[];
  isStatic: boolean;
  isReadonly: boolean;
}

export interface ImportInfo {
  source: string;
  specifiers: Array<{
    name: string;
    alias?: string;
    isDefault: boolean;
    isNamespace: boolean;
  }>;
  isTypeOnly: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface';
  isDefault: boolean;
  source?: string; // for re-exports
}

export interface CodeComplexity {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  maintainabilityIndex: number;
}

export interface FileComplexity extends CodeComplexity {
  totalFunctions: number;
  totalClasses: number;
  averageFunctionComplexity: number;
  averageClassComplexity: number;
}

export interface AnalysisError {
  type: 'syntax' | 'semantic' | 'parsing';
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
}

export interface CodeChangeAnalysis {
  changeType: 'added' | 'modified' | 'deleted' | 'moved' | 'renamed';
  impactLevel: 'low' | 'medium' | 'high';
  affectedFunctions: string[];
  affectedClasses: string[];
  affectedTests: string[];
  dependencies: string[];
  similarityScore: number;
  summary: string;
  recommendations: string[];
}

export interface FingerprintConfig {
  includeParameterNames: boolean;
  includeParameterTypes: boolean;
  includeReturnType: boolean;
  includeModifiers: boolean;
  includeClassName: boolean;
  caseSensitive: boolean;
}

export interface ParserConfig {
  language:
    | 'typescript'
    | 'javascript'
    | 'python'
    | 'java'
    | 'cpp'
    | 'c'
    | 'go'
    | 'rust';
  version?: string;
  strict: boolean;
  includeComments: boolean;
  includeDocstrings: boolean;
  maxComplexity?: number;
  excludePatterns: string[];
}

export interface CodeStructureComparison {
  added: FunctionInfo[];
  deleted: FunctionInfo[];
  modified: Array<{
    old: FunctionInfo;
    new: FunctionInfo;
    changes: string[];
  }>;
  moved: Array<{
    function: FunctionInfo;
    oldPath: string;
    newPath: string;
  }>;
  renamed: Array<{
    oldName: string;
    newName: string;
    function: FunctionInfo;
  }>;
}
