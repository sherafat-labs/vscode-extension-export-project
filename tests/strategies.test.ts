import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { FullFolderStrategy } from '../src/strategies/FullFolderStrategy';
import { FilePatternStrategy } from '../src/strategies/FilePatternStrategy';
import { FolderFilesStrategy } from '../src/strategies/FolderFilesStrategy';
import { FileCollector } from '../src/core/FileCollector';
import { DEFAULT_CONFIG } from '../src/config/defaults';

describe('File Strategies & FileCollector Unit Tests', () => {
  const tmpDir = path.join(__dirname, 'tmp_strategies');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    fs.mkdirSync(path.join(tmpDir, 'src/app'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src/app/index.ts'), 'console.log("app");');
    fs.writeFileSync(path.join(tmpDir, 'src/app/util.ts'), 'export const a = 1;');
    fs.writeFileSync(path.join(tmpDir, 'config.json'), '{}');
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('FullFolderStrategy gathers all files respecting excludes', async () => {
    const strat = new FullFolderStrategy({
      name: 'full-test',
      type: 'full',
      root: './',
    });

    const results = await strat.collect({
      workspaceRoot: tmpDir,
      globalExclude: ['**/config.json'],
      respectGitignore: false,
      binaryDetection: true,
    });

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].relativePath, 'src/app/index.ts');
    assert.strictEqual(results[1].relativePath, 'src/app/util.ts');
  });

  it('FilePatternStrategy matches glob patterns', async () => {
    const strat = new FilePatternStrategy({
      name: 'pattern-test',
      type: 'pattern',
      patterns: ['**/*.json'],
    });

    const results = await strat.collect({
      workspaceRoot: tmpDir,
      globalExclude: [],
      respectGitignore: false,
      binaryDetection: false,
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].relativePath, 'config.json');
  });

  it('FolderFilesStrategy collects files from specified paths', async () => {
    const strat = new FolderFilesStrategy({
      name: 'folder-test',
      type: 'folder',
      paths: ['src/app'],
      includeExtensions: ['.ts'],
    });

    const results = await strat.collect({
      workspaceRoot: tmpDir,
      globalExclude: [],
      respectGitignore: false,
      binaryDetection: false,
    });

    assert.strictEqual(results.length, 2);
  });

  it('FileCollector orchestrates strategies', async () => {
    const config = {
      ...DEFAULT_CONFIG,
      strategies: [
        {
          name: 'app-folder',
          type: 'folder' as const,
          paths: ['src/app'],
        },
      ],
    };

    const collector = new FileCollector(config, tmpDir);
    const files = await collector.collectAll();
    assert.strictEqual(files.length, 2);
  });
});
