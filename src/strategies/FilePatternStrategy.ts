import * as path from 'path';
import fg from 'fast-glob';
import { minimatch } from 'minimatch';
import { ExportStrategy, ExportContext, CollectedFileRef } from './ExportStrategy';
import { FilePatternStrategyConfig } from '../config/schema';
import { getRelativePath, normalizePath } from '../utils/paths';

export class FilePatternStrategy implements ExportStrategy {
  public name: string;

  constructor(private config: FilePatternStrategyConfig) {
    this.name = config.name;
  }

  public async collect(ctx: ExportContext): Promise<CollectedFileRef[]> {
    const excludePatterns = [...(ctx.globalExclude || []), ...(this.config.exclude || [])];

    const files = await fg(this.config.patterns, {
      cwd: ctx.workspaceRoot,
      absolute: true,
      dot: true,
      ignore: excludePatterns,
    });

    const results: CollectedFileRef[] = [];

    for (const absPath of files) {
      const relPath = getRelativePath(absPath, ctx.workspaceRoot);

      // Check minimatch excludes explicitly
      const isExcluded = excludePatterns.some((pattern) =>
        minimatch(relPath, pattern, { dot: true, matchBase: true })
      );
      if (isExcluded) {
        continue;
      }

      results.push({
        absolutePath: absPath,
        relativePath: relPath,
        reason: `Pattern match: ${this.name}`,
      });
    }

    // Deterministic sort
    results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    return results;
  }
}
