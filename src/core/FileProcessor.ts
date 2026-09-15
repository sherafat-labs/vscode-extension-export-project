import * as fs from 'fs';
import * as path from 'path';
import { FormatConfig } from '../config/schema';
import { estimateTokens } from '../utils/tokens';

export interface ProcessedFile {
  absolutePath: string;
  relativePath: string;
  content: string;
  originalSize: number;
  processedSize: number;
  tokensEstimate: number;
  reason?: string;
  languageId?: string;
}

export class FileProcessor {
  constructor(private config: FormatConfig) {}

  public async processFile(
    absolutePath: string,
    relativePath: string,
    reason?: string
  ): Promise<ProcessedFile | null> {
    try {
      if (!fs.existsSync(absolutePath)) {
        return null;
      }

      const stats = await fs.promises.stat(absolutePath);
      const sizeKB = stats.size / 1024;
      if (this.config.maxFileSizeKB && sizeKB > this.config.maxFileSizeKB) {
        return null; // Skip file if larger than maxFileSizeKB
      }

      let content = await fs.promises.readFile(absolutePath, {
        encoding: this.config.encoding || 'utf8',
      });

      const languageId = this.detectLanguage(relativePath);

      if (this.config.stripComments) {
        content = this.stripComments(content, languageId, !!this.config.keepLicenseHeader);
      }

      if (this.config.stripImports) {
        content = this.stripImports(content, languageId);
      }

      if (this.config.collapseBlankLines) {
        content = content.replace(/\n{3,}/g, '\n\n');
      }

      // Trim trailing whitespace per line
      content = content
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .trim();

      if (this.config.includeLineNumbers) {
        content = this.addLineNumbers(content);
      }

      const formattedContent = this.applyHeaderAndFooter(content, relativePath, reason);
      const tokensEstimate = estimateTokens(formattedContent);

      return {
        absolutePath,
        relativePath,
        content: formattedContent,
        originalSize: stats.size,
        processedSize: Buffer.byteLength(formattedContent, 'utf8'),
        tokensEstimate,
        reason,
        languageId,
      };
    } catch {
      return null;
    }
  }

  public applyHeaderAndFooter(content: string, relativePath: string, reason?: string): string {
    const headerTpl = this.config.header || '// ===== FILE: {path} =====';
    const footerTpl = this.config.footer || '// ===== END: {path} =====';

    let header = headerTpl.replace(/{path}/g, relativePath);
    if (reason) {
      header += `\n// Reason: ${reason}`;
    }
    const footer = footerTpl.replace(/{path}/g, relativePath);

    return `${header}\n${content}\n${footer}`;
  }

  private addLineNumbers(content: string): string {
    const lines = content.split('\n');
    const width = lines.length.toString().length;
    return lines
      .map((line, idx) => {
        const lineNum = (idx + 1).toString().padStart(width, ' ');
        return `${lineNum} | ${line}`;
      })
      .join('\n');
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
      case '.cjs':
      case '.mjs':
        return 'javascript';
      case '.html':
      case '.htm':
        return 'html';
      case '.css':
      case '.scss':
      case '.less':
        return 'css';
      case '.py':
        return 'python';
      case '.json':
        return 'json';
      case '.md':
        return 'markdown';
      case '.sh':
      case '.bash':
        return 'shell';
      default:
        return 'plaintext';
    }
  }

  private stripComments(content: string, languageId: string, keepLicenseHeader: boolean): string {
    let licenseHeader = '';
    if (keepLicenseHeader) {
      const match = content.match(/^(\/\*[\s\S]*?\*\/|\/\/[^\n]*\n+)/);
      if (match && match[0].toLowerCase().includes('license')) {
        licenseHeader = match[0] + '\n';
      }
    }

    if (languageId === 'typescript' || languageId === 'javascript' || languageId === 'css') {
      // Strip block comments (/* */) and line comments (//)
      content = content.replace(/\/\*[\s\S]*?\*\//g, '');
      content = content.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    } else if (languageId === 'python' || languageId === 'shell') {
      content = content.replace(/(^|\s)#[^\n]*/g, '$1');
    } else if (languageId === 'html') {
      content = content.replace(/<!--[\s\S]*?-->/g, '');
    }

    if (licenseHeader && !content.startsWith(licenseHeader)) {
      content = licenseHeader + content;
    }

    return content;
  }

  private stripImports(content: string, languageId: string): string {
    if (languageId === 'typescript' || languageId === 'javascript') {
      // Remove ES import statements & require statements
      content = content.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');
      content = content.replace(/^import\s+['"][^'"]+['"];?/gm, '');
      content = content.replace(/^(const|let|var)\s+.*=\s*require\(['"][^'"]+['"]\);?/gm, '');
    }
    return content;
  }
}
