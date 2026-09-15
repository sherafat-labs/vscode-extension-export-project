import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';
import { minimatch } from 'minimatch';
import { ExportStrategy, ExportContext, CollectedFileRef } from './ExportStrategy';
import { FullFolderStrategyConfig } from '../config/schema';
import { getRelativePath, resolvePath, normalizePath } from '../utils/paths';

export class FullFolderStrategy implements ExportStrategy {
  public name: string;

  constructor(private config: FullFolderStrategyConfig) {
    this.name = config.name;
  }

  public async collect(ctx: ExportContext): Promise<CollectedFileRef[]> {
    const rootDir = resolvePath(this.config.root || './', ctx.workspaceRoot);
    if (!fs.existsSync(rootDir)) {
      return [];
    }

    const ig = ignore();
    if (ctx.respectGitignore && this.config.respectGitignore !== false) {
      const gitignorePath = path.join(ctx.workspaceRoot, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        try {
          const content = fs.readFileSync(gitignorePath, 'utf8');
          ig.add(content);
        } catch {
          // Ignore unreadable .gitignore
        }
      }
    }

    const excludePatterns = [...(ctx.globalExclude || []), ...(this.config.exclude || [])];
    const results: CollectedFileRef[] = [];

    const walk = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const absPath = path.join(dir, entry.name);
        const relPath = getRelativePath(absPath, ctx.workspaceRoot);

        if (relPath === '' || relPath === '.') continue;

        // Check gitignore
        if (ig.ignores(relPath)) {
          continue;
        }

        // Check global and config excludes
        const isExcluded = excludePatterns.some((pattern) =>
          minimatch(relPath, pattern, { dot: true, matchBase: true })
        );
        if (isExcluded) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(absPath);
        } else if (entry.isFile()) {
          // Check extensions
          if (this.config.includeExtensions && this.config.includeExtensions.length > 0) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!this.config.includeExtensions.includes(ext)) {
              continue;
            }
          }

          // Check binary detection
          if (ctx.binaryDetection && (await this.isBinary(absPath))) {
            continue;
          }

          results.push({
            absolutePath: absPath,
            relativePath: relPath,
            reason: `Full strategy: ${this.name}`,
          });
        }
      }
    };

    await walk(rootDir);

    // Deterministic sort
    results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    return results;
  }

  private async isBinary(filePath: string): Promise<boolean> {
    try {
      const fd = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(8192);
      const { bytesRead } = await fd.read(buffer, 0, 8192, 0);
      await fd.close();

      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
}
