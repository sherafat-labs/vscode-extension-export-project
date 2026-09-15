import * as path from 'path';

/**
 * Normalizes file paths to use forward slashes for cross-platform consistency.
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Returns the relative path from workspace root, normalized with forward slashes.
 */
export function getRelativePath(absolutePath: string, rootDir: string): string {
  const rel = path.relative(rootDir, absolutePath);
  return normalizePath(rel);
}

/**
 * Resolves a path relative to workspace root if not absolute.
 */
export function resolvePath(targetPath: string, rootDir: string): string {
  if (path.isAbsolute(targetPath)) {
    return path.normalize(targetPath);
  }
  return path.resolve(rootDir, targetPath);
}
