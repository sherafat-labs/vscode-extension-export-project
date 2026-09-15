import * as fs from 'fs';
import * as path from 'path';
import { SourceExporterConfig } from '../config/schema';
import { ProcessedFile } from './FileProcessor';
import { estimateTokens } from '../utils/tokens';
import { resolvePath } from '../utils/paths';

export interface OutputResult {
  writtenFiles: string[];
  totalFiles: number;
  totalTokens: number;
  totalSize: number;
  manifest?: any;
}

export class OutputWriter {
  constructor(private config: SourceExporterConfig, private workspaceRoot: string) {}

  public async write(
    files: ProcessedFile[],
    projectName: string = 'SourceExporterProject'
  ): Promise<OutputResult> {
    const outDir = resolvePath(this.config.output.directory, this.workspaceRoot);
    if (!fs.existsSync(outDir)) {
      await fs.promises.mkdir(outDir, { recursive: true });
    }

    const writtenFiles: string[] = [];
    const mode = this.config.output.mode || 'single';

    if (mode === 'single') {
      const results = await this.writeSingleMode(files, outDir, projectName);
      writtenFiles.push(...results);
    } else {
      const results = await this.writeMultiMode(files, outDir, projectName);
      writtenFiles.push(...results);
    }

    const totalFiles = files.length;
    const totalTokens = files.reduce((acc, f) => acc + f.tokensEstimate, 0);
    const totalSize = files.reduce((acc, f) => acc + f.processedSize, 0);

    return {
      writtenFiles,
      totalFiles,
      totalTokens,
      totalSize,
    };
  }

  public generateTree(files: ProcessedFile[]): string {
    const paths = files.map((f) => f.relativePath);
    interface TreeNode {
      [key: string]: TreeNode;
    }
    const root: TreeNode = {};

    for (const p of paths) {
      const parts = p.split('/');
      let curr = root;
      for (const part of parts) {
        if (!curr[part]) {
          curr[part] = {};
        }
        curr = curr[part];
      }
    }

    function renderTree(node: TreeNode, indent: string = ''): string {
      const keys = Object.keys(node).sort();
      let treeStr = '';
      keys.forEach((key, index) => {
        const isLast = index === keys.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        const childIndent = indent + (isLast ? '    ' : '│   ');
        treeStr += `${indent}${prefix}${key}\n`;
        treeStr += renderTree(node[key], childIndent);
      });
      return treeStr;
    }

    return `Project Tree Structure:\n.\n${renderTree(root)}`;
  }

  public generateManifest(
    files: ProcessedFile[],
    projectName: string
  ): any {
    const totalTokens = files.reduce((acc, f) => acc + f.tokensEstimate, 0);
    return {
      generatedAt: new Date().toISOString(),
      projectName,
      strategies: this.config.strategies.map((s) => s.name),
      files: files.map((f) => ({
        path: f.relativePath,
        tokens: f.tokensEstimate,
        reason: f.reason || 'included',
      })),
      totalFiles: files.length,
      totalTokens,
    };
  }

  private async writeSingleMode(
    files: ProcessedFile[],
    outDir: string,
    projectName: string
  ): Promise<string[]> {
    const fileNameTpl = this.config.output.fileName || 'project-{timestamp}.txt';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = fileNameTpl.replace(/{timestamp}/g, timestamp);

    const blocks: string[] = [];

    if (this.config.output.includeManifest) {
      const manifest = this.generateManifest(files, projectName);
      blocks.push(`/* MANIFEST:\n${JSON.stringify(manifest, null, 2)}\n*/`);
    }

    if (this.config.output.includeTree) {
      const tree = this.generateTree(files);
      blocks.push(`/* FILE TREE:\n${tree}\n*/`);
    }

    const separator = this.config.format.fileSeparator || '\n\n';

    // Check token budget splitting if enabled
    const maxTokens = this.config.tokenBudget.maxTokens || 100000;
    const splitEnabled = this.config.tokenBudget.enabled && this.config.tokenBudget.splitWhenExceeded;

    const writtenPaths: string[] = [];

    if (!splitEnabled) {
      for (const file of files) {
        blocks.push(file.content);
      }
      const fullContent = blocks.join(separator);
      const filePath = path.join(outDir, baseFileName);
      await fs.promises.writeFile(filePath, fullContent, 'utf8');
      writtenPaths.push(filePath);
    } else {
      let currentBlocks: string[] = [...blocks];
      let currentTokens = estimateTokens(currentBlocks.join(separator));
      let fileIndex = 1;

      const getFileName = (idx: number) => {
        const ext = path.extname(baseFileName);
        const nameWithoutExt = baseFileName.substring(0, baseFileName.length - ext.length);
        return idx === 1 ? baseFileName : `${nameWithoutExt}-part${idx}${ext}`;
      };

      for (const file of files) {
        const fileTokens = file.tokensEstimate;
        if (currentBlocks.length > 0 && currentTokens + fileTokens > maxTokens) {
          // Flush current file
          const currentContent = currentBlocks.join(separator);
          const currentFilePath = path.join(outDir, getFileName(fileIndex));
          await fs.promises.writeFile(currentFilePath, currentContent, 'utf8');
          writtenPaths.push(currentFilePath);

          fileIndex++;
          currentBlocks = [];
          currentTokens = 0;
        }

        currentBlocks.push(file.content);
        currentTokens += fileTokens;
      }

      if (currentBlocks.length > 0) {
        const currentContent = currentBlocks.join(separator);
        const currentFilePath = path.join(outDir, getFileName(fileIndex));
        await fs.promises.writeFile(currentFilePath, currentContent, 'utf8');
        writtenPaths.push(currentFilePath);
      }
    }

    return writtenPaths;
  }

  private async writeMultiMode(
    files: ProcessedFile[],
    outDir: string,
    projectName: string
  ): Promise<string[]> {
    const groupBy = this.config.output.multiGroupBy || 'strategy';
    const groups: { [key: string]: ProcessedFile[] } = {};

    for (const file of files) {
      let groupKey = 'default';
      if (groupBy === 'strategy') {
        groupKey = file.reason || 'default';
      } else if (groupBy === 'folder') {
        const parts = file.relativePath.split('/');
        groupKey = parts.length > 1 ? parts[0] : 'root';
      } else {
        groupKey = 'custom';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(file);
    }

    const writtenPaths: string[] = [];

    for (const [groupKey, groupFiles] of Object.entries(groups)) {
      const sanitizedKey = groupKey.replace(/[^a-zA-Z0-9_-]/g, '_');
      const baseFileName = `${sanitizedKey}.txt`;
      const blocks: string[] = [];

      if (this.config.output.includeManifest) {
        const manifest = this.generateManifest(groupFiles, `${projectName}-${groupKey}`);
        blocks.push(`/* MANIFEST:\n${JSON.stringify(manifest, null, 2)}\n*/`);
      }

      if (this.config.output.includeTree) {
        const tree = this.generateTree(groupFiles);
        blocks.push(`/* FILE TREE:\n${tree}\n*/`);
      }

      for (const file of groupFiles) {
        blocks.push(file.content);
      }

      const separator = this.config.format.fileSeparator || '\n\n';
      const fullContent = blocks.join(separator);
      const filePath = path.join(outDir, baseFileName);
      await fs.promises.writeFile(filePath, fullContent, 'utf8');
      writtenPaths.push(filePath);
    }

    return writtenPaths;
  }
}
