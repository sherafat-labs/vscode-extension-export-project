# Source Exporter — Build & Usage Guide

**Source Exporter** is a VS Code extension designed to export project source code into clean, token-efficient `.txt` files optimized for feeding into AI chatbots (such as Claude, ChatGPT, etc.).

---

## 🛠️ Build & Installation Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **VS Code**: ^1.85.0

### Step 1: Install Dependencies
In the root directory of the extension repository, run:
```bash
npm install
```

### Step 2: Compile and Build Extension
To build the production JS bundle using `esbuild`:
```bash
npm run build
```

To run TypeScript compiler checks:
```bash
npm run compile
```

To run unit and integration tests:
```bash
npm test
```

### Step 3: Package into a `.vsix` Extension File
To package the extension for distribution and local installation in VS Code:
```bash
npx @vscode/vsce package
```
This generates a file named `source-exporter-0.1.0.vsix`.

### Step 4: Install in VS Code
You can install the `.vsix` package in VS Code via:
- **CLI**:
  ```bash
  code --install-extension source-exporter-0.1.0.vsix
  ```
- **VS Code GUI**:
  1. Open VS Code.
  2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`).
  3. Click the **`...`** (Views and More Actions) menu in the top right.
  4. Select **Install from VSIX...** and choose `source-exporter-0.1.0.vsix`.

---

## 🚀 Usage Guide

### Overview of Features
- **4 Export Strategies**: Full Folder (`full`), File Pattern (`pattern`), Folder Files (`folder`), and AST Dependency Tree Resolver (`dependency`).
- **Token Optimization**: Language-aware comment stripping (`//`, `/* */`, `#`, `<!-- -->`), import stripping, collapsing blank lines, whitespace trimming, and line numbers option.
- **Manifest & Tree Overview**: Option to prepend JSON metadata manifest and an ASCII folder tree structure.
- **Token Budget & Auto-Splitting**: Splits exports into numbered parts (e.g., `project-part1.txt`, `project-part2.txt`) if token limits are exceeded.

---

### Configuration (`.source-exporter.json`)

Place a `.source-exporter.json` file in your workspace root, or configure VS Code settings under `sourceExporter.*`.

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

### 💻 Available Commands & Context Menus

1. **`Source Exporter: Export Project`**
   - **Command**: `sourceExporter.exportProject`
   - **How to run**: Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
   - Runs all defined strategies and outputs the result to the configured output directory.

2. **`Source Exporter: Export Strategy`**
   - **Command**: `sourceExporter.exportStrategy`
   - Opens a QuickPick menu allowing you to select and export a single configured strategy.

3. **`Source Exporter: Export File and Dependencies`**
   - **Command**: `sourceExporter.exportFromFile`
   - **How to run**: Right-click any file in the File Explorer or inside an open Editor tab, then click **"Source Exporter: Export File and Dependencies"**.
   - Traces imports, type dependencies, and NestJS decorators using AST up to depth 3 and exports the minimal required files.

4. **`Source Exporter: Preview Export`**
   - **Command**: `sourceExporter.previewExport`
   - Opens an untitled editor window displaying the exact exported text without saving any file to disk.

5. **`Source Exporter: Open Configuration File`**
   - **Command**: `sourceExporter.openConfig`
   - Opens `.source-exporter.json` in VS Code (creates a default `.source-exporter.json` if missing).
