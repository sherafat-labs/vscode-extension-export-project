import * as fs from 'fs';
import * as path from 'path';
import { SourceExporterConfig, validateConfig } from '../config/schema';
import { DEFAULT_CONFIG, mergeConfigs } from '../config/defaults';
import { FileCollector } from './FileCollector';
import { OutputWriter, OutputResult } from './OutputWriter';
import { Logger } from '../utils/logger';

export class Exporter {
  private config: SourceExporterConfig;

  constructor(private workspaceRoot: string, customConfig?: Partial<SourceExporterConfig>) {
    const loadedConfig = this.loadWorkspaceConfig();
    this.config = mergeConfigs(DEFAULT_CONFIG, loadedConfig, customConfig);

    const validationErrors = validateConfig(this.config);
    if (validationErrors.length > 0) {
      Logger.warn(`Configuration warnings: ${JSON.stringify(validationErrors)}`);
    }
  }

  private loadWorkspaceConfig(): Partial<SourceExporterConfig> {
    const configFile = path.join(this.workspaceRoot, '.source-exporter.json');
    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, 'utf8');
        return JSON.parse(raw);
      } catch (err) {
        Logger.error(`Failed to parse .source-exporter.json: ${err}`);
      }
    }
    return {};
  }

  public getConfig(): SourceExporterConfig {
    return this.config;
  }

  public async export(
    selectedStrategyNames?: string[],
    projectName?: string
  ): Promise<OutputResult> {
    const collector = new FileCollector(this.config, this.workspaceRoot);
    const processedFiles = await collector.collectAll(selectedStrategyNames);

    const writer = new OutputWriter(this.config, this.workspaceRoot);
    const pName = projectName || path.basename(this.workspaceRoot) || 'ExportedProject';

    return await writer.write(processedFiles, pName);
  }

  public async generatePreview(selectedStrategyNames?: string[]): Promise<string> {
    const collector = new FileCollector(this.config, this.workspaceRoot);
    const processedFiles = await collector.collectAll(selectedStrategyNames);

    const writer = new OutputWriter(this.config, this.workspaceRoot);
    const pName = path.basename(this.workspaceRoot) || 'ExportedProject';

    const blocks: string[] = [];
    if (this.config.output.includeManifest) {
      const manifest = writer.generateManifest(processedFiles, pName);
      blocks.push(`/* MANIFEST:\n${JSON.stringify(manifest, null, 2)}\n*/`);
    }

    if (this.config.output.includeTree) {
      const tree = writer.generateTree(processedFiles);
      blocks.push(`/* FILE TREE:\n${tree}\n*/`);
    }

    for (const file of processedFiles) {
      blocks.push(file.content);
    }

    const separator = this.config.format.fileSeparator || '\n\n';
    return blocks.join(separator);
  }
}
