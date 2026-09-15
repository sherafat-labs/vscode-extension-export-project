import * as path from 'path';
import { SourceExporterConfig } from './schema';

export const DEFAULT_CONFIG: SourceExporterConfig = {
  output: {
    mode: 'single',
    directory: './exports',
    fileName: 'project-{timestamp}.txt',
    multiGroupBy: 'strategy',
    includeManifest: true,
    includeTree: true,
    includeLineNumbers: false,
  },
  format: {
    header: '// ===== FILE: {path} =====',
    footer: '// ===== END: {path} =====',
    fileSeparator: '\n\n',
    collapseBlankLines: true,
    stripComments: false,
    stripImports: false,
    maxFileSizeKB: 500,
    encoding: 'utf8',
    keepLicenseHeader: true,
  },
  filters: {
    respectGitignore: true,
    include: ['**/*'],
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/*.lock',
      '**/*.png',
      '**/*.jpg',
      '**/*.svg',
      '**/*.min.*',
    ],
    binaryDetection: true,
  },
  strategies: [
    {
      name: 'everything',
      type: 'full',
      root: './',
      respectGitignore: true,
    },
  ],
  tokenBudget: {
    enabled: true,
    maxTokens: 100000,
    splitWhenExceeded: true,
  },
};

export function mergeConfigs(
  defaultConfig: SourceExporterConfig,
  vscodeSettings?: Partial<SourceExporterConfig>,
  fileConfig?: Partial<SourceExporterConfig>
): SourceExporterConfig {
  const merged: SourceExporterConfig = {
    output: { ...defaultConfig.output, ...vscodeSettings?.output, ...fileConfig?.output },
    format: { ...defaultConfig.format, ...vscodeSettings?.format, ...fileConfig?.format },
    filters: { ...defaultConfig.filters, ...vscodeSettings?.filters, ...fileConfig?.filters },
    tokenBudget: { ...defaultConfig.tokenBudget, ...vscodeSettings?.tokenBudget, ...fileConfig?.tokenBudget },
    strategies: fileConfig?.strategies || vscodeSettings?.strategies || defaultConfig.strategies,
  };

  return merged;
}
