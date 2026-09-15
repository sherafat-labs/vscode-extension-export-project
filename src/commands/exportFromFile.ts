import * as vscode from 'vscode';
import * as path from 'path';
import { Exporter } from '../core/Exporter';
import { getRelativePath } from '../utils/paths';
import { Logger } from '../utils/logger';

export async function exportFromFileCommand(
  uri?: vscode.Uri,
  statusBarItem?: vscode.StatusBarItem
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  let targetUri = uri;
  if (!targetUri) {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      targetUri = activeEditor.document.uri;
    }
  }

  if (!targetUri) {
    vscode.window.showErrorMessage('No file selected to export.');
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const relPath = getRelativePath(targetUri.fsPath, rootPath);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Source Exporter: Exporting ${relPath} and dependencies...`,
      cancellable: true,
    },
    async () => {
      try {
        const dynamicConfig = {
          strategies: [
            {
              name: `file-${path.basename(relPath)}`,
              type: 'dependency' as const,
              entry: relPath,
              depth: 3,
            },
          ],
        };

        const exporter = new Exporter(rootPath, dynamicConfig);
        const result = await exporter.export();

        if (statusBarItem) {
          statusBarItem.text = `$(output) Tokens: ${result.totalTokens.toLocaleString()}`;
          statusBarItem.show();
        }

        vscode.window.showInformationMessage(
          `Exported file and dependencies for ${relPath} (${result.totalFiles} files, ${result.totalTokens} tokens)`
        );
      } catch (err: any) {
        Logger.error(`Export from file ${relPath} failed`, err);
        vscode.window.showErrorMessage(`Export from file failed: ${err.message || err}`);
      }
    }
  );
}
