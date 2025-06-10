export interface CodeChangeEvent {
  repository: string;
  filePath: string;
  changeType: 'modified' | 'moved' | 'deleted' | 'renamed';
  oldContent?: string;
  newContent?: string;
  oldFilePath?: string; // for renamed/moved files
  affectedReferences: string[];
  commitHash: string;
  timestamp: Date;
}

export interface SmartTrackingConfig {
  enableFunctionTracking: boolean;
  enableLineMovementDetection: boolean;
  conflictResolutionStrategy: 'manual' | 'auto' | 'notify';
  notificationChannels: ('slack' | 'email')[];
}

export interface FunctionSignature {
  name: string;
  parameters: string[];
  returnType?: string;
  startLine: number;
  endLine: number;
  hash: string; // content hash for change detection
}

export interface CodeMovementResult {
  found: boolean;
  newStartLine?: number;
  newEndLine?: number;
  confidence: number; // 0-1 scale
  reason?: string;
}

export interface ConflictResolution {
  referenceId: string;
  conflictType: 'deleted' | 'moved' | 'modified';
  resolution: 'update' | 'ignore' | 'manual';
  newContent?: string;
  newStartLine?: number;
  newEndLine?: number;
}

export interface NotificationPayload {
  documentId: string;
  referenceId: string;
  changeType: string;
  oldContent: string;
  newContent?: string;
  conflictResolution?: ConflictResolution;
} 