import { ProcessedFile } from '../core/FileProcessor';

export interface ExportContext {
  workspaceRoot: string;
  globalExclude: string[];
  respectGitignore: boolean;
  binaryDetection: boolean;
}

export interface CollectedFileRef {
  absolutePath: string;
  relativePath: string;
  reason: string;
}

export interface ExportStrategy {
  name: string;
  collect(ctx: ExportContext): Promise<CollectedFileRef[]>;
}
