import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DEFAULT_CONFIG } from '../config/defaults';

export async function openConfigCommand(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const configPath = path.join(rootPath, '.source-exporter.json');

  if (!fs.existsSync(configPath)) {
    const jsonContent = JSON.stringify(DEFAULT_CONFIG, null, 2);
    await fs.promises.writeFile(configPath, jsonContent, 'utf8');
  }

  const doc = await vscode.workspace.openTextDocument(configPath);
  await vscode.window.showTextDocument(doc);
}
