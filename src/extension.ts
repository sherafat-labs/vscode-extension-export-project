import * as vscode from 'vscode';
import { exportProjectCommand } from './commands/exportProject';
import { exportStrategyCommand } from './commands/exportStrategy';
import { exportFromFileCommand } from './commands/exportFromFile';
import { openConfigCommand } from './commands/openConfig';
import { previewExportCommand } from './commands/previewExport';
import { Logger } from './utils/logger';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  Logger.info('Source Exporter extension activating...');

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'sourceExporter.previewExport';
  statusBarItem.text = '$(output) Source Exporter';
  statusBarItem.tooltip = 'Click to preview export';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  const c1 = vscode.commands.registerCommand('sourceExporter.exportProject', () =>
    exportProjectCommand(statusBarItem)
  );
  const c2 = vscode.commands.registerCommand('sourceExporter.exportStrategy', () =>
    exportStrategyCommand(statusBarItem)
  );
  const c3 = vscode.commands.registerCommand('sourceExporter.exportFromFile', (uri?: vscode.Uri) =>
    exportFromFileCommand(uri, statusBarItem)
  );
  const c4 = vscode.commands.registerCommand('sourceExporter.openConfig', () =>
    openConfigCommand()
  );
  const c5 = vscode.commands.registerCommand('sourceExporter.previewExport', () =>
    previewExportCommand()
  );

  context.subscriptions.push(c1, c2, c3, c4, c5);
  Logger.info('Source Exporter extension successfully activated.');
}

export function deactivate() {
  Logger.info('Source Exporter extension deactivated.');
}
