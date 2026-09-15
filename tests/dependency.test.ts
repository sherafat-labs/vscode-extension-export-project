import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { DependencyResolver } from '../src/core/DependencyResolver';
import { DependencyStrategy } from '../src/strategies/DependencyStrategy';

describe('DependencyResolver & Strategy Unit Tests', () => {
  const tmpDir = path.join(__dirname, 'tmp_dep');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { '@nestjs/core': '^10.0.0' } })
    );

    const authServiceContent = `
export class AuthService {
  login() {
    return true;
  }
  logout() {
    return false;
  }
}
`;
    const authModuleContent = `
import { AuthService } from './auth.service';

export class AuthModule {}
`;

    fs.writeFileSync(path.join(tmpDir, 'auth.service.ts'), authServiceContent);
    fs.writeFileSync(path.join(tmpDir, 'auth.module.ts'), authModuleContent);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('resolves dependency tree topologically (dependencies before entry)', async () => {
    const resolver = new DependencyResolver(tmpDir);
    const resolved = await resolver.resolveDependencies(
      {
        name: 'test-dep',
        type: 'dependency',
        entry: 'auth.module.ts',
        depth: 2,
      },
      {
        workspaceRoot: tmpDir,
        globalExclude: [],
        respectGitignore: false,
        binaryDetection: false,
      }
    );

    assert.strictEqual(resolved.length, 2);
    // Topological sort puts dependency (auth.service.ts) before entry (auth.module.ts)
    assert.strictEqual(resolved[0].relativePath, 'auth.service.ts');
    assert.strictEqual(resolved[1].relativePath, 'auth.module.ts');
  });

  it('filters by symbols when requested', async () => {
    const resolver = new DependencyResolver(tmpDir);
    const resolved = await resolver.resolveDependencies(
      {
        name: 'test-symbol',
        type: 'dependency',
        entry: 'auth.service.ts',
        symbols: ['AuthService.login'],
        depth: 0,
      },
      {
        workspaceRoot: tmpDir,
        globalExclude: [],
        respectGitignore: false,
        binaryDetection: false,
      }
    );

    assert.strictEqual(resolved.length, 1);
    assert.ok(resolved[0].content);
    assert.ok(resolved[0].content.includes('login()'));
    assert.ok(resolved[0].content.includes('lines omitted'));
  });
});
