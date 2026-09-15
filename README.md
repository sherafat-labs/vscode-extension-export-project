# Source Exporter (VS Code Extension)

**Source Exporter** is a VS Code extension designed to export project source code into clean, token-efficient `.txt` files optimized for feeding into AI chatbots (like Claude, ChatGPT, etc.).

## Features

- **Token Minimization**: Strip comments (language-aware), collapse blank lines, trim trailing whitespace, and remove redundant formatting.
- **Configurable Output Modes**: Single concatenated export file or multi-file exports grouped by strategy or folder.
- **Token Budgeting & Splitting**: Automatically split export files when a configurable token limit is exceeded.
- **Manifest & Tree Overview**: Option to include JSON metadata manifest and ASCII directory tree at top of output files.
- **4 Export Strategies**:
  1. **Full Folder (`full`)**: Recursively walk root/folder respecting `.gitignore`, global excludes, and binary file detection.
  2. **File Pattern (`pattern`)**: Glob pattern matching (`fast-glob`).
  3. **Folder Files (`folder`)**: Filtered recursive file collection within specific directories.
  4. **Dependency Tree (`dependency`)**: AST-based code path & dependency resolver powered by `ts-morph` with framework adapters (NestJS `@Module`/providers/controllers, React, Generic TS/JS) and symbol-level tree shaking.
- **VS Code Commands & Context Menus**: Export project, export specific strategy, export file + dependencies from Explorer right-click or editor context menu, open configuration file, and preview export in text editor.

---

## Example Configuration (`.source-exporter.json`)

Create `.source-exporter.json` in your workspace root:

```json
{
  "output": {
    "mode": "single",
    "directory": "./exports",
    "fileName": "project-{timestamp}.txt",
    "multiGroupBy": "strategy",
    "includeManifest": true,
    "includeTree": true,
    "includeLineNumbers": false
  },
  "format": {
    "header": "// ===== FILE: {path} =====",
    "footer": "// ===== END: {path} =====",
    "fileSeparator": "\n\n",
    "collapseBlankLines": true,
    "stripComments": false,
    "stripImports": false,
    "maxFileSizeKB": 500,
    "encoding": "utf8"
  },
  "filters": {
    "respectGitignore": true,
    "include": ["**/*"],
    "exclude": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/*.lock",
      "**/*.png",
      "**/*.jpg",
      "**/*.svg",
      "**/*.min.*"
    ],
    "binaryDetection": true
  },
  "strategies": [
    {
      "name": "core-app",
      "type": "folder",
      "paths": ["src/app", "src/core"],
      "recursive": true,
      "includeExtensions": [".ts", ".tsx"]
    },
    {
      "name": "configs",
      "type": "pattern",
      "patterns": ["**/*.config.{ts,js,json}", "tsconfig*.json"],
      "exclude": ["**/node_modules/**"]
    },
    {
      "name": "auth-feature",
      "type": "dependency",
      "entry": "src/modules/auth/auth.service.ts",
      "symbols": ["AuthService.login", "AuthService.validateUser"],
      "depth": 2,
      "includeTypes": true,
      "includeTests": false
    },
    {
      "name": "everything",
      "type": "full",
      "root": "./",
      "respectGitignore": true
    }
  ],
  "tokenBudget": {
    "enabled": true,
    "maxTokens": 100000,
    "splitWhenExceeded": true
  }
}
```

---

## Common Use Cases

### 1. "Feed my whole NestJS app to Claude"
Run `Source Exporter: Export Project` command from Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

### 2. "Export only the auth module + its dependencies"
Right-click on `auth.service.ts` in File Explorer or active editor tab and select **"Source Exporter: Export File and Dependencies"**.

### 3. "Export config files only"
Run `Source Exporter: Export Strategy` and select the `configs` strategy from the QuickPick menu.

---

## Commands

- `sourceExporter.exportProject`: Export project using active strategy set.
- `sourceExporter.exportStrategy`: Select and run a single strategy.
- `sourceExporter.exportFromFile`: Export selected file and its dependency graph.
- `sourceExporter.openConfig`: Open or create `.source-exporter.json`.
- `sourceExporter.previewExport`: Generate preview in untitled editor window without saving files.

---

## Building `.vsix` Package

To package the extension into a `.vsix` file for installation or distribution:

```bash
npm run build
npx @vscode/vsce package
```
