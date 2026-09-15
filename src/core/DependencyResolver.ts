import * as fs from 'fs';
import * as path from 'path';
import { Project, SourceFile, Node, SyntaxKind, ClassDeclaration, MethodDeclaration, FunctionDeclaration, ImportDeclaration } from 'ts-morph';
import { DependencyStrategyConfig } from '../config/schema';
import { ExportContext, CollectedFileRef } from '../strategies/ExportStrategy';
import { getRelativePath, resolvePath } from '../utils/paths';
import { Logger } from '../utils/logger';

export interface ResolvedDependencyFile {
  absolutePath: string;
  relativePath: string;
  content?: string;
  reason: string;
}

export class DependencyResolver {
  private project: Project | null = null;
  private frameworkType: 'nestjs' | 'react' | 'generic' = 'generic';

  constructor(private workspaceRoot: string) {
    this.detectFramework();
  }

  private detectFramework(): void {
    const pkgPath = path.join(this.workspaceRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['@nestjs/core'] || deps['@nestjs/common']) {
          this.frameworkType = 'nestjs';
        } else if (deps['react'] || deps['next']) {
          this.frameworkType = 'react';
        }
      } catch {
        // Fallback to generic
      }
    }
  }

  private initProject(): Project {
    if (this.project) return this.project;

    const tsconfigPath = path.join(this.workspaceRoot, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      try {
        this.project = new Project({
          tsConfigFilePath: tsconfigPath,
          skipAddingFilesFromTsConfig: false,
        });
        return this.project;
      } catch (err) {
        Logger.warn(`Failed to load tsconfig.json with ts-morph, falling back to basic project: ${err}`);
      }
    }

    this.project = new Project({
      compilerOptions: {
        allowJs: true,
        target: 99, // ESNext
      },
    });
    return this.project;
  }

  public async resolveDependencies(
    config: DependencyStrategyConfig,
    ctx: ExportContext
  ): Promise<ResolvedDependencyFile[]> {
    const project = this.initProject();
    const entryAbsPath = resolvePath(config.entry, this.workspaceRoot);

    if (!fs.existsSync(entryAbsPath)) {
      Logger.warn(`Dependency entry file does not exist: ${entryAbsPath}`);
      return [];
    }

    let entrySourceFile = project.getSourceFile(entryAbsPath);
    if (!entrySourceFile) {
      entrySourceFile = project.addSourceFileAtPath(entryAbsPath);
    }

    const maxDepth = config.depth !== undefined ? config.depth : 2;
    const includeTypes = config.includeTypes !== false;
    const includeNodeModules = !!config.includeNodeModules;

    const visited = new Set<string>();
    const dependencyGraph = new Map<string, Set<string>>(); // A -> set of dependencies B (A depends on B)
    const fileReasons = new Map<string, string>();
    const fileContents = new Map<string, string>();

    interface QueueItem {
      sourceFile: SourceFile;
      depth: number;
      reason: string;
    }

    const queue: QueueItem[] = [
      {
        sourceFile: entrySourceFile,
        depth: 0,
        reason: `Entry file for ${config.name}`,
      },
    ];

    visited.add(entrySourceFile.getFilePath());
    fileReasons.set(
      entrySourceFile.getFilePath(),
      `Entry file: ${getRelativePath(entrySourceFile.getFilePath(), this.workspaceRoot)}`
    );

    while (queue.length > 0) {
      const { sourceFile, depth, reason } = queue.shift()!;
      const currentFilePath = sourceFile.getFilePath();

      if (!dependencyGraph.has(currentFilePath)) {
        dependencyGraph.set(currentFilePath, new Set());
      }

      // Check if symbol level filtering applies to this file
      if (config.symbols && config.symbols.length > 0 && depth === 0) {
        const filteredCode = this.filterBySymbols(sourceFile, config.symbols);
        if (filteredCode) {
          fileContents.set(currentFilePath, filteredCode);
        }
      }

      if (depth >= maxDepth) {
        continue;
      }

      // Extract dependencies from source file
      const importedSourceFiles = this.extractDependencies(
        sourceFile,
        includeTypes,
        includeNodeModules
      );

      for (const { importedFile, importReason } of importedSourceFiles) {
        const importedPath = importedFile.getFilePath();
        dependencyGraph.get(currentFilePath)!.add(importedPath);

        if (!visited.has(importedPath)) {
          visited.add(importedPath);
          fileReasons.set(importedPath, importReason);
          queue.push({
            sourceFile: importedFile,
            depth: depth + 1,
            reason: importReason,
          });
        }
      }
    }

    // Topological sort (dependencies first, entry last)
    const sortedFilePaths = this.topologicalSort(dependencyGraph);

    const result: ResolvedDependencyFile[] = [];
    for (const filePath of sortedFilePaths) {
      const relPath = getRelativePath(filePath, this.workspaceRoot);
      result.push({
        absolutePath: filePath,
        relativePath: relPath,
        content: fileContents.get(filePath),
        reason: fileReasons.get(filePath) || `Dependency of ${config.name}`,
      });
    }

    return result;
  }

  private extractDependencies(
    sourceFile: SourceFile,
    includeTypes: boolean,
    includeNodeModules: boolean
  ): { importedFile: SourceFile; importReason: string }[] {
    const results: { importedFile: SourceFile; importReason: string }[] = [];
    const sourceRel = getRelativePath(sourceFile.getFilePath(), this.workspaceRoot);

    // 1. Regular Imports & Type-only imports
    const importDeclarations = sourceFile.getImportDeclarations();
    for (const importDecl of importDeclarations) {
      if (importDecl.isTypeOnly() && !includeTypes) {
        continue;
      }

      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const importedSf = importDecl.getModuleSpecifierSourceFile();

      if (importedSf) {
        if (!includeNodeModules && importedSf.isInNodeModules()) {
          continue;
        }
        results.push({
          importedFile: importedSf,
          importReason: `Imported by ${sourceRel} ("${moduleSpecifier}")`,
        });
      }
    }

    // 2. Dynamic imports and require statements
    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();
        // require('...')
        if (expression.getText() === 'require') {
          const args = node.getArguments();
          if (args.length > 0 && Node.isStringLiteral(args[0])) {
            const specifier = args[0].getLiteralValue();
            const symbol = node.getType().getSymbol();
            const declaration = symbol?.getDeclarations()?.[0];
            const importedSf = declaration?.getSourceFile();
            if (importedSf && (!importedSf.isInNodeModules() || includeNodeModules)) {
              results.push({
                importedFile: importedSf,
                importReason: `Required by ${sourceRel} ("${specifier}")`,
              });
            }
          }
        }
        // import('...')
        else if (expression.getKind() === SyntaxKind.ImportKeyword) {
          const args = node.getArguments();
          if (args.length > 0 && Node.isStringLiteral(args[0])) {
            const specifier = args[0].getLiteralValue();
            const importedSf = node.getType().getSymbol()?.getDeclarations()?.[0]?.getSourceFile();
            if (importedSf && (!importedSf.isInNodeModules() || includeNodeModules)) {
              results.push({
                importedFile: importedSf,
                importReason: `Dynamic imported by ${sourceRel} ("${specifier}")`,
              });
            }
          }
        }
      }
    });

    // 3. NestJS Framework specific metadata extraction (@Module, @Inject, @forwardRef)
    if (this.frameworkType === 'nestjs') {
      const nestDeps = this.extractNestJSDependencies(sourceFile, includeNodeModules);
      results.push(...nestDeps);
    }

    return results;
  }

  private extractNestJSDependencies(
    sourceFile: SourceFile,
    includeNodeModules: boolean
  ): { importedFile: SourceFile; importReason: string }[] {
    const results: { importedFile: SourceFile; importReason: string }[] = [];
    const sourceRel = getRelativePath(sourceFile.getFilePath(), this.workspaceRoot);

    // Look for decorators (@Module, @Controller, @Injectable)
    for (const classDecl of sourceFile.getClasses()) {
      for (const decorator of classDecl.getDecorators()) {
        const name = decorator.getName();
        if (name === 'Module') {
          const args = decorator.getArguments();
          if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
            const obj = args[0];
            const properties = obj.getProperties();
            for (const prop of properties) {
              if (Node.isPropertyAssignment(prop)) {
                const propName = prop.getName();
                if (['imports', 'controllers', 'providers', 'exports'].includes(propName)) {
                  const initializer = prop.getInitializer();
                  if (Node.isArrayLiteralExpression(initializer)) {
                    for (const element of initializer.getElements()) {
                      const symbol = element.getType().getSymbol();
                      const sf = symbol?.getDeclarations()?.[0]?.getSourceFile();
                      if (sf && (!sf.isInNodeModules() || includeNodeModules)) {
                        results.push({
                          importedFile: sf,
                          importReason: `NestJS @Module ${propName} in ${sourceRel} (${element.getText()})`,
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return results;
  }

  private filterBySymbols(sourceFile: SourceFile, targetSymbols: string[]): string | null {
    const fullText = sourceFile.getFullText();
    const lines = fullText.split('\n');

    const matchedNodes: Node[] = [];

    for (const targetSymbol of targetSymbols) {
      // Handles Symbol names like "AuthService" or "AuthService.login"
      const parts = targetSymbol.split('.');
      const className = parts[0];
      const methodName = parts.length > 1 ? parts[1] : undefined;

      for (const classDecl of sourceFile.getClasses()) {
        if (classDecl.getName() === className) {
          if (!methodName) {
            matchedNodes.push(classDecl);
          } else {
            const method = classDecl.getMethod(methodName);
            if (method) {
              matchedNodes.push(method);
            }
          }
        }
      }

      for (const funcDecl of sourceFile.getFunctions()) {
        if (funcDecl.getName() === className) {
          matchedNodes.push(funcDecl);
        }
      }
    }

    if (matchedNodes.length === 0) {
      return null;
    }

    // Retain imports + matched declarations, insert omitted lines marker for gaps
    const retainedRanges: { startLine: number; endLine: number }[] = [];

    // Keep import statements
    for (const imp of sourceFile.getImportDeclarations()) {
      retainedRanges.push({
        startLine: imp.getStartLineNumber() - 1,
        endLine: imp.getEndLineNumber() - 1,
      });
    }

    // Keep matched nodes
    for (const node of matchedNodes) {
      retainedRanges.push({
        startLine: node.getStartLineNumber() - 1,
        endLine: node.getEndLineNumber() - 1,
      });
    }

    // Sort ranges
    retainedRanges.sort((a, b) => a.startLine - b.startLine);

    const resultLines: string[] = [];
    let lastLineIndex = 0;

    for (const range of retainedRanges) {
      if (range.startLine > lastLineIndex) {
        const omittedCount = range.startLine - lastLineIndex;
        if (omittedCount > 0) {
          resultLines.push(`// ... [${omittedCount} lines omitted] ...`);
        }
      }

      const start = Math.max(lastLineIndex, range.startLine);
      for (let i = start; i <= range.endLine; i++) {
        if (i < lines.length) {
          resultLines.push(lines[i]);
        }
      }

      lastLineIndex = range.endLine + 1;
    }

    if (lastLineIndex < lines.length) {
      const omittedCount = lines.length - lastLineIndex;
      if (omittedCount > 0) {
        resultLines.push(`// ... [${omittedCount} lines omitted] ...`);
      }
    }

    return resultLines.join('\n');
  }

  private topologicalSort(graph: Map<string, Set<string>>): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const tempVisited = new Set<string>();

    const visit = (node: string) => {
      if (tempVisited.has(node)) {
        // Cycle detected, break cycle
        return;
      }
      if (!visited.has(node)) {
        tempVisited.add(node);
        const neighbors = graph.get(node) || new Set();
        for (const neighbor of neighbors) {
          visit(neighbor);
        }
        tempVisited.delete(node);
        visited.add(node);
        result.push(node);
      }
    };

    for (const node of graph.keys()) {
      visit(node);
    }

    return result;
  }
}
