import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { FileProcessor } from '../src/core/FileProcessor';
import { OutputWriter } from '../src/core/OutputWriter';
import { DEFAULT_CONFIG } from '../src/config/defaults';

describe('FileProcessor & OutputWriter Unit Tests', () => {
  const tmpDir = path.join(__dirname, 'tmp');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('FileProcessor strips comments and collapses blank lines', async () => {
    const testFile = path.join(tmpDir, 'test.ts');
    const content = `// This is a single comment
/* Block comment */
function hello() {


  return "world";
}
`;
    fs.writeFileSync(testFile, content, 'utf8');

    const processor = new FileProcessor({
      ...DEFAULT_CONFIG.format,
      stripComments: true,
      collapseBlankLines: true,
    });

    const result = await processor.processFile(testFile, 'test.ts');
    assert.ok(result);
    assert.strictEqual(result.content.includes('// This is a single comment'), false);
    assert.strictEqual(result.content.includes('/* Block comment */'), false);
    assert.strictEqual(result.content.includes('function hello()'), true);
  });

  it('OutputWriter generates tree, manifest, and single file export', async () => {
    const writer = new OutputWriter(DEFAULT_CONFIG, tmpDir);
    const mockFiles = [
      {
        absolutePath: path.join(tmpDir, 'src/index.ts'),
        relativePath: 'src/index.ts',
        content: '// ===== FILE: src/index.ts =====\nconsole.log("hello");\n// ===== END: src/index.ts =====',
        originalSize: 100,
        processedSize: 100,
        tokensEstimate: 20,
        reason: 'matched',
      },
    ];

    const res = await writer.write(mockFiles, 'TestProject');
    assert.strictEqual(res.writtenFiles.length, 1);
    assert.ok(fs.existsSync(res.writtenFiles[0]));

    const writtenContent = fs.readFileSync(res.writtenFiles[0], 'utf8');
    assert.ok(writtenContent.includes('MANIFEST'));
    assert.ok(writtenContent.includes('FILE TREE'));
    assert.ok(writtenContent.includes('src/index.ts'));
  });
});
