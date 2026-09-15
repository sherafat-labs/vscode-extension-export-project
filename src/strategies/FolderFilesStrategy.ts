import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { ExportStrategy, ExportContext, CollectedFileRef } from './ExportStrategy';
import { FolderFilesStrategyConfig } from '../config/schema';
import { getRelativePath, resolvePath } from '../utils/paths';

export class FolderFilesStrategy implements ExportStrategy {
  public name: string;

  constructor(private config: FolderFilesStrategyConfig) {
    this.name = config.name;
  }

  public async collect(ctx: ExportContext): Promise<CollectedFileRef[]> {
    const excludePatterns = [...(ctx.globalExclude || []), ...(this.config.exclude || [])];
    const results: CollectedFileRef[] = [];
    const isRecursive = this.config.recursive !== false;
    const maxDepth = this.config.maxDepth !== undefined ? this.config.maxDepth : Infinity;

    for (const targetPath of this.config.paths) {
      const absDir = resolvePath(targetPath, ctx.workspaceRoot);
      if (!fs.existsSync(absDir)) {
        continue;
      }

      const walk = async (dir: string, currentDepth: number) => {
        if (currentDepth > maxDepth) return;

        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const absPath = path.join(dir, entry.name);
          const relPath = getRelativePath(absPath, ctx.workspaceRoot);

          const isExcluded = excludePatterns.some((pattern) =>
            minimatch(relPath, pattern, { dot: true, matchBase: true })
          );
          if (isExcluded) {
            continue;
          }

          if (entry.isDirectory()) {
            if (isRecursive) {
              await walk(absPath, currentDepth + 1);
            }
          } else if (entry.isFile()) {
            if (this.config.includeExtensions && this.config.includeExtensions.length > 0) {
              const ext = path.extname(entry.name).toLowerCase();
              if (!this.config.includeExtensions.includes(ext)) {
                continue;
              }
            }

            results.push({
              absolutePath: absPath,
              relativePath: relPath,
              reason: `Folder files: ${this.name}`,
            });
          }
        }
      };

      const stat = await fs.promises.stat(absDir);
      if (stat.isDirectory()) {
        await walk(absDir, 1);
      } else if (stat.isFile()) {
        const relPath = getRelativePath(absDir, ctx.workspaceRoot);
        results.push({
          absolutePath: absDir,
          relativePath: relPath,
          reason: `Folder file: ${this.name}`,
        });
      }
    }

    // Deterministic sort
    results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    return results;
  }
}
