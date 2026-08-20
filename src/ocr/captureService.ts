import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

interface CaptureCommand {
  readonly command: string;
  readonly args: readonly string[];
}

const run = (spec: CaptureCommand): Promise<void> => new Promise((resolve, reject) => {
  const child = spawn(spec.command, spec.args, { windowsHide: true, stdio: 'ignore' });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${spec.command} 退出码 ${code ?? 'unknown'}`)));
});

export function captureCommands(platform: NodeJS.Platform, outputPath: string, windowsScript: string): readonly CaptureCommand[] {
  if (platform === 'win32') {
    return [{
      command: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', windowsScript, '-OutputPath', outputPath],
    }];
  }
  if (platform === 'darwin') return [{ command: '/usr/sbin/screencapture', args: ['-x', outputPath] }];
  return [
    { command: 'gnome-screenshot', args: ['-f', outputPath] },
    { command: 'spectacle', args: ['-b', '-n', '-o', outputPath] },
    { command: 'grim', args: [outputPath] },
    { command: 'scrot', args: [outputPath] },
    { command: 'import', args: ['-window', 'root', outputPath] },
  ];
}

export async function captureFullScreen(outputPath: string, windowsScript: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const errors: string[] = [];
  for (const command of captureCommands(process.platform, outputPath, windowsScript)) {
    try {
      await run(command);
      const info = await stat(outputPath);
      if (info.size > 0) return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`无法调用系统截图工具：${errors.join('；')}`);
}

