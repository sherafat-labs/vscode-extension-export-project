import { ExportStrategy, ExportContext, CollectedFileRef } from './ExportStrategy';
import { DependencyStrategyConfig } from '../config/schema';
import { DependencyResolver } from '../core/DependencyResolver';

export class DependencyStrategy implements ExportStrategy {
  public name: string;

  constructor(private config: DependencyStrategyConfig) {
    this.name = config.name;
  }

  public async collect(ctx: ExportContext): Promise<CollectedFileRef[]> {
    const resolver = new DependencyResolver(ctx.workspaceRoot);
    const resolvedFiles = await resolver.resolveDependencies(this.config, ctx);

    return resolvedFiles.map((res) => ({
      absolutePath: res.absolutePath,
      relativePath: res.relativePath,
      reason: res.reason,
    }));
  }
}
