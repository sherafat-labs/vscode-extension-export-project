import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { Exporter } from '../src/core/Exporter';

describe('Integration Test: NestJS Project Exporter', () => {
  const fixtureDir = path.join(__dirname, 'fixture_nestjs_app');

  beforeEach(() => {
    if (fs.existsSync(fixtureDir)) {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(fixtureDir, 'src/modules/auth'), { recursive: true });
    fs.mkdirSync(path.join(fixtureDir, 'src/config'), { recursive: true });

    // Package.json
    fs.writeFileSync(
      path.join(fixtureDir, 'package.json'),
      JSON.stringify({
        name: 'sample-nestjs-app',
        dependencies: { '@nestjs/core': '^10.0.0' },
      })
    );

    // Config files
    fs.writeFileSync(path.join(fixtureDir, 'src/config/app.config.ts'), 'export const port = 3000;');

    // Auth module files
    fs.writeFileSync(
      path.join(fixtureDir, 'src/modules/auth/auth.service.ts'),
      `export class AuthService {\n  login() { return "token"; }\n}`
    );
    fs.writeFileSync(
      path.join(fixtureDir, 'src/modules/auth/auth.controller.ts'),
      `import { AuthService } from './auth.service';\nexport class AuthController {}`
    );

    // .source-exporter.json
    const configContent = {
      output: {
        mode: 'single',
        directory: './exports',
        fileName: 'export-{timestamp}.txt',
        includeManifest: true,
        includeTree: true,
      },
      format: {
        header: '// ===== FILE: {path} =====',
        footer: '// ===== END: {path} =====',
        fileSeparator: '\n\n',
        collapseBlankLines: true,
        stripComments: true,
      },
      filters: {
        respectGitignore: true,
        exclude: ['**/node_modules/**'],
        binaryDetection: true,
      },
      strategies: [
        {
          name: 'configs',
          type: 'pattern',
          patterns: ['src/config/*.ts'],
        },
        {
          name: 'auth-feature',
          type: 'dependency',
          entry: 'src/modules/auth/auth.controller.ts',
          depth: 2,
        },
      ],
      tokenBudget: {
        enabled: true,
        maxTokens: 50, // Small token budget to force split
        splitWhenExceeded: true,
      },
    };

    fs.writeFileSync(
      path.join(fixtureDir, '.source-exporter.json'),
      JSON.stringify(configContent, null, 2)
    );
  });

  afterEach(() => {
    if (fs.existsSync(fixtureDir)) {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it('performs end-to-end export on NestJS project and handles token budget splitting', async () => {
    const exporter = new Exporter(fixtureDir);
    const result = await exporter.export();

    assert.ok(result.totalFiles >= 3);
    assert.ok(result.writtenFiles.length >= 2, 'Should split into multiple files when token budget is exceeded');

    for (const writtenFile of result.writtenFiles) {
      assert.ok(fs.existsSync(writtenFile));
      const text = fs.readFileSync(writtenFile, 'utf8');
      assert.ok(text.length > 0);
    }
  });
});
