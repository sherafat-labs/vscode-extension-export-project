export type OutputMode = 'single' | 'multi';
export type MultiGroupBy = 'strategy' | 'folder' | 'custom';
export type StrategyType = 'full' | 'pattern' | 'folder' | 'dependency';

export interface FullFolderStrategyConfig {
  name: string;
  type: 'full';
  root?: string;
  respectGitignore?: boolean;
  includeExtensions?: string[];
  exclude?: string[];
}

export interface FilePatternStrategyConfig {
  name: string;
  type: 'pattern';
  patterns: string[];
  exclude?: string[];
}

export interface FolderFilesStrategyConfig {
  name: string;
  type: 'folder';
  paths: string[];
  recursive?: boolean;
  maxDepth?: number;
  includeExtensions?: string[];
  exclude?: string[];
}

export interface DependencyStrategyConfig {
  name: string;
  type: 'dependency';
  entry: string;
  symbols?: string[];
  depth?: number;
  includeTypes?: boolean;
  includeTests?: boolean;
  includeNodeModules?: boolean;
  exclude?: string[];
}

export type StrategyConfig =
  | FullFolderStrategyConfig
  | FilePatternStrategyConfig
  | FolderFilesStrategyConfig
  | DependencyStrategyConfig;

export interface OutputConfig {
  mode: OutputMode;
  directory: string;
  fileName: string;
  multiGroupBy: MultiGroupBy;
  includeManifest: boolean;
  includeTree: boolean;
  includeLineNumbers: boolean;
}

export interface FormatConfig {
  header: string;
  footer: string;
  fileSeparator: string;
  collapseBlankLines: boolean;
  stripComments: boolean;
  stripImports: boolean;
  maxFileSizeKB: number;
  encoding: BufferEncoding;
  keepLicenseHeader?: boolean;
  includeLineNumbers?: boolean;
}

export interface FiltersConfig {
  respectGitignore: boolean;
  include: string[];
  exclude: string[];
  binaryDetection: boolean;
}

export interface TokenBudgetConfig {
  enabled: boolean;
  maxTokens: number;
  splitWhenExceeded: boolean;
}

export interface SourceExporterConfig {
  output: OutputConfig;
  format: FormatConfig;
  filters: FiltersConfig;
  strategies: StrategyConfig[];
  tokenBudget: TokenBudgetConfig;
}

export interface ConfigValidationError {
  path: string;
  message: string;
}

export function validateConfig(config: any): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  if (typeof config !== 'object' || config === null) {
    return [{ path: 'root', message: 'Configuration must be an object' }];
  }

  if (config.output) {
    if (config.output.mode && !['single', 'multi'].includes(config.output.mode)) {
      errors.push({ path: 'output.mode', message: 'output.mode must be "single" or "multi"' });
    }
    if (config.output.multiGroupBy && !['strategy', 'folder', 'custom'].includes(config.output.multiGroupBy)) {
      errors.push({ path: 'output.multiGroupBy', message: 'output.multiGroupBy must be "strategy", "folder", or "custom"' });
    }
  }

  if (config.strategies && Array.isArray(config.strategies)) {
    config.strategies.forEach((strat: any, index: number) => {
      if (!strat.name || typeof strat.name !== 'string') {
        errors.push({ path: `strategies[${index}].name`, message: 'Strategy must have a string name' });
      }
      if (!['full', 'pattern', 'folder', 'dependency'].includes(strat.type)) {
        errors.push({ path: `strategies[${index}].type`, message: 'Strategy type must be "full", "pattern", "folder", or "dependency"' });
      }
      if (strat.type === 'pattern' && (!Array.isArray(strat.patterns) || strat.patterns.length === 0)) {
        errors.push({ path: `strategies[${index}].patterns`, message: 'Pattern strategy must provide patterns array' });
      }
      if (strat.type === 'folder' && (!Array.isArray(strat.paths) || strat.paths.length === 0)) {
        errors.push({ path: `strategies[${index}].paths`, message: 'Folder strategy must provide paths array' });
      }
      if (strat.type === 'dependency' && (!strat.entry || typeof strat.entry !== 'string')) {
        errors.push({ path: `strategies[${index}].entry`, message: 'Dependency strategy must provide entry string' });
      }
    });
  }

  return errors;
}
