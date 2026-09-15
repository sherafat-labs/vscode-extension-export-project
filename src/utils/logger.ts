export class Logger {
  private static channel: any;

  public static getChannel(): any {
    if (!Logger.channel) {
      try {
        const vscode = require('vscode');
        Logger.channel = vscode.window.createOutputChannel('Source Exporter');
      } catch {
        // VS Code host not available (e.g. running in unit test)
      }
    }
    return Logger.channel;
  }

  public static info(message: string): void {
    const formatted = `[INFO ${new Date().toISOString()}] ${message}`;
    console.log(formatted);
    try {
      const channel = Logger.getChannel();
      if (channel) {
        channel.appendLine(formatted);
      }
    } catch {
      // Ignore
    }
  }

  public static warn(message: string): void {
    const formatted = `[WARN ${new Date().toISOString()}] ${message}`;
    console.warn(formatted);
    try {
      const channel = Logger.getChannel();
      if (channel) {
        channel.appendLine(formatted);
      }
    } catch {
      // Ignore
    }
  }

  public static error(message: string, error?: any): void {
    const formatted = `[ERROR ${new Date().toISOString()}] ${message} ${error ? error.stack || error : ''}`;
    console.error(formatted);
    try {
      const channel = Logger.getChannel();
      if (channel) {
        channel.appendLine(formatted);
      }
    } catch {
      // Ignore
    }
  }
}
