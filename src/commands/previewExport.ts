import * as vscode from 'vscode';
import { Exporter } from '../core/Exporter';
import { Logger } from '../utils/logger';

export async function previewExportCommand(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Source Exporter: Generating preview...',
      cancellable: true,
    },
    async () => {
      try {
        const exporter = new Exporter(rootPath);
        const previewText = await exporter.generatePreview();

        const doc = await vscode.workspace.openTextDocument({
          content: previewText,
          language: 'plaintext',
        });

        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (err: any) {
        Logger.error('Preview export failed', err);
        vscode.window.showErrorMessage(`Preview export failed: ${err.message || err}`);
      }
    }
  );
}
