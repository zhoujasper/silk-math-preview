import { spawn } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MAX_IMAGE_BYTES } from './protocol';

export interface CaptureCommand { readonly command: string; readonly args: readonly string[]; }
class CommandFailure extends Error {
  constructor(readonly code: number | string | null, message: string) { super(message); }
}

export function runImageCommand(spec: CaptureCommand, signal?: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.command, spec.args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...(signal ? { signal } : {}) });
    const chunks: Buffer[] = [];
    let length = 0;
    let stderr = '';
    let tooLarge = false;
    const timer = setTimeout(() => child.kill(), 180_000);
    child.stdout.on('data', (chunk: Buffer) => {
      length += chunk.length;
      if (length > MAX_IMAGE_BYTES) { tooLarge = true; child.kill(); return; }
      chunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-1500); });
    child.once('error', (error: NodeJS.ErrnoException) => { clearTimeout(timer); reject(new CommandFailure(error.code ?? null, error.message)); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (signal?.aborted) reject(new Error('cancelled'));
      else if (tooLarge) reject(new Error('image-too-large'));
      else if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new CommandFailure(code, stderr.trim() || `${spec.command} (${code ?? 'timeout'})`));
    });
  });
}

export function captureCommands(platform: NodeJS.Platform, outputPath: string, windowsScript: string): readonly CaptureCommand[] {
  if (platform === 'win32') return [{ command: 'powershell.exe', args: ['-NoLogo', '-NoProfile', '-STA', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', windowsScript, '-OutputPath', outputPath] }];
  if (platform === 'darwin') return [{ command: '/usr/sbin/screencapture', args: ['-i', '-s', '-x', outputPath] }];
  return [
    { command: 'gnome-screenshot', args: ['-a', '-f', outputPath] },
    { command: 'spectacle', args: ['-r', '-b', '-n', '-o', outputPath] },
    { command: 'scrot', args: ['-s', '-f', outputPath] },
  ];
}

export async function captureRegion(outputPath: string, windowsScript: string, signal?: AbortSignal): Promise<boolean> {
  await mkdir(dirname(outputPath), { recursive: true });
  if (process.platform === 'linux' && process.env.WAYLAND_DISPLAY) {
    try {
      const bounds = (await runImageCommand({ command: 'slurp', args: [] }, signal)).toString().trim();
      if (!bounds) return false;
      await runImageCommand({ command: 'grim', args: ['-g', bounds, outputPath] }, signal);
      return (await stat(outputPath)).size > 0;
    } catch (error) {
      if (!(error instanceof CommandFailure) || error.code !== 'ENOENT') {
        if (error instanceof CommandFailure && error.code === 1) return false;
        throw error;
      }
    }
  }
  for (const spec of captureCommands(process.platform, outputPath, windowsScript)) {
    try {
      await runImageCommand(spec, signal);
      return await stat(outputPath).then((file) => file.size > 0, () => false);
    } catch (error) {
      if (error instanceof CommandFailure && error.code === 'ENOENT') continue;
      if (error instanceof CommandFailure && (error.code === 2 || (error.code === 1 && /cancel|^\/usr\/sbin\/screencapture \(1\)$/.test(error.message)))) return false;
      throw error;
    }
  }
  throw new Error('screenshot-unavailable');
}

export async function readClipboardImage(outputPath: string, resources: string, signal?: AbortSignal): Promise<boolean> {
  await mkdir(dirname(outputPath), { recursive: true });
  if (process.platform === 'darwin') {
    await runImageCommand({ command: '/usr/bin/osascript', args: ['-l', 'JavaScript', join(resources, 'read-clipboard-macos.js'), outputPath] }, signal);
  } else if (process.platform === 'win32') {
    await runImageCommand({ command: 'powershell.exe', args: ['-NoLogo', '-NoProfile', '-STA', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(resources, 'capture-windows.ps1'), '-Mode', 'clipboard', '-OutputPath', outputPath] }, signal);
  } else {
    const commands = process.env.WAYLAND_DISPLAY
      ? [{ command: 'wl-paste', args: ['--no-newline', '--type', 'image/png'] }, { command: 'xclip', args: ['-selection', 'clipboard', '-t', 'image/png', '-o'] }]
      : [{ command: 'xclip', args: ['-selection', 'clipboard', '-t', 'image/png', '-o'] }];
    for (const command of commands) {
      try {
        const bytes = await runImageCommand(command, signal);
        if (bytes.length) { await writeFile(outputPath, bytes); break; }
      } catch (error) {
        if (signal?.aborted) throw error;
        if (!(error instanceof CommandFailure)) throw error;
      }
    }
  }
  return stat(outputPath).then((file) => file.size > 0, () => false);
}
