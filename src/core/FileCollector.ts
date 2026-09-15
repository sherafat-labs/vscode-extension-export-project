import { SourceExporterConfig } from '../config/schema';
import { ExportStrategy, ExportContext, CollectedFileRef } from '../strategies/ExportStrategy';
import { FullFolderStrategy } from '../strategies/FullFolderStrategy';
import { FilePatternStrategy } from '../strategies/FilePatternStrategy';
import { FolderFilesStrategy } from '../strategies/FolderFilesStrategy';
import { DependencyStrategy } from '../strategies/DependencyStrategy';
import { FileProcessor, ProcessedFile } from './FileProcessor';

export class FileCollector {
  constructor(private config: SourceExporterConfig, private workspaceRoot: string) {}

  public async collectAll(selectedStrategyNames?: string[]): Promise<ProcessedFile[]> {
    const ctx: ExportContext = {
      workspaceRoot: this.workspaceRoot,
      globalExclude: this.config.filters.exclude || [],
      respectGitignore: this.config.filters.respectGitignore,
      binaryDetection: this.config.filters.binaryDetection,
    };

    const strategiesToRun = this.config.strategies.filter((s) => {
      if (!selectedStrategyNames || selectedStrategyNames.length === 0) {
        return true;
      }
      return selectedStrategyNames.includes(s.name);
    });

    const collectedRefsMap = new Map<string, CollectedFileRef>();

    for (const stratConfig of strategiesToRun) {
      let strategyInstance: ExportStrategy | null = null;

      if (stratConfig.type === 'full') {
        strategyInstance = new FullFolderStrategy(stratConfig);
      } else if (stratConfig.type === 'pattern') {
        strategyInstance = new FilePatternStrategy(stratConfig);
      } else if (stratConfig.type === 'folder') {
        strategyInstance = new FolderFilesStrategy(stratConfig);
      } else if (stratConfig.type === 'dependency') {
        strategyInstance = new DependencyStrategy(stratConfig);
      }

      if (strategyInstance) {
        const refs = await strategyInstance.collect(ctx);
        for (const ref of refs) {
          if (!collectedRefsMap.has(ref.absolutePath)) {
            collectedRefsMap.set(ref.absolutePath, ref);
          }
        }
      }
    }

    const processor = new FileProcessor(this.config.format);
    const processedFiles: ProcessedFile[] = [];

    const sortedRefs = Array.from(collectedRefsMap.values());

    for (const ref of sortedRefs) {
      const processed = await processor.processFile(
        ref.absolutePath,
        ref.relativePath,
        ref.reason
      );
      if (processed) {
        processedFiles.push(processed);
      }
    }

    return processedFiles;
  }
}
