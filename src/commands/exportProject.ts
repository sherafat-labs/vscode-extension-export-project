import * as vscode from 'vscode';
import { Exporter } from '../core/Exporter';
import { Logger } from '../utils/logger';

export async function exportProjectCommand(
  statusBarItem?: vscode.StatusBarItem
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Source Exporter: Exporting project...',
      cancellable: true,
    },
    async (progress, token) => {
      try {
        const exporter = new Exporter(rootPath);
        if (token.isCancellationRequested) return;

        progress.report({ message: 'Collecting and processing files...' });
        const result = await exporter.export();

        if (statusBarItem) {
          statusBarItem.text = `$(output) Tokens: ${result.totalTokens.toLocaleString()}`;
          statusBarItem.show();
        }

        const msg = `Export complete! ${result.totalFiles} files exported (${result.totalTokens} tokens) to ${result.writtenFiles.length} file(s).`;
        Logger.info(msg);
        vscode.window.showInformationMessage(msg);
      } catch (err: any) {
        Logger.error('Export failed', err);
        vscode.window.showErrorMessage(`Export failed: ${err.message || err}`);
      }
    }
  );
}
