import * as vscode from 'vscode';
import { Exporter } from '../core/Exporter';
import { Logger } from '../utils/logger';

export async function exportStrategyCommand(
  statusBarItem?: vscode.StatusBarItem
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const exporter = new Exporter(rootPath);
  const config = exporter.getConfig();

  if (!config.strategies || config.strategies.length === 0) {
    vscode.window.showWarningMessage('No strategies defined in configuration.');
    return;
  }

  const items = config.strategies.map((s) => ({
    label: s.name,
    description: `Type: ${s.type}`,
    strategy: s,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a strategy to export',
  });

  if (!selected) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Source Exporter: Exporting strategy '${selected.label}'...`,
      cancellable: true,
    },
    async (progress) => {
      try {
        const result = await exporter.export([selected.label]);

        if (statusBarItem) {
          statusBarItem.text = `$(output) Tokens: ${result.totalTokens.toLocaleString()}`;
          statusBarItem.show();
        }

        vscode.window.showInformationMessage(
          `Strategy '${selected.label}' exported successfully! (${result.totalFiles} files, ${result.totalTokens} tokens)`
        );
      } catch (err: any) {
        Logger.error(`Export strategy '${selected.label}' failed`, err);
        vscode.window.showErrorMessage(`Export strategy failed: ${err.message || err}`);
      }
    }
  );
}
