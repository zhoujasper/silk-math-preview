import { spawn } from 'node:child_process';

export const MAC_IMAGE_CLIPBOARD = `ObjC.import('AppKit');
var png = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
var image = $.NSImage.alloc.initWithData(png);
if (!image || image.isNil()) throw new Error('invalid-png');
var tiff = image.TIFFRepresentation;
var board = $.NSPasteboard.generalPasteboard;
board.clearContents;
if (!board.setDataForType(png, $.NSPasteboardTypePNG)) throw new Error('clipboard-write-failed');
if (tiff && !tiff.isNil()) board.setDataForType(tiff, $.NSPasteboardTypeTIFF);`;

export const WINDOWS_IMAGE_CLIPBOARD = `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$stream = New-Object System.IO.MemoryStream
$image = $null
try {
  [Console]::OpenStandardInput().CopyTo($stream)
  $stream.Position = 0
  $image = [System.Drawing.Image]::FromStream($stream)
  $data = New-Object System.Windows.Forms.DataObject
  $data.SetImage($image)
  $stream.Position = 0
  $data.SetData('PNG', $false, $stream)
  [System.Windows.Forms.Clipboard]::SetDataObject($data, $true, 5, 100)
} finally {
  if ($null -ne $image) { $image.Dispose() }
  $stream.Dispose()
}`;

export function imageClipboardCommands(platform: NodeJS.Platform, wayland: boolean): readonly { command: string; args: string[] }[] {
  if (platform === 'darwin') return [{ command: '/usr/bin/osascript', args: ['-l', 'JavaScript', '-e', MAC_IMAGE_CLIPBOARD] }];
  if (platform === 'win32') return [{ command: 'powershell.exe', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', Buffer.from(WINDOWS_IMAGE_CLIPBOARD, 'utf16le').toString('base64')] }];
  if (platform === 'linux') {
    const x11 = { command: 'xclip', args: ['-selection', 'clipboard', '-target', 'image/png', '-in'] };
    const wl = { command: 'wl-copy', args: ['--type', 'image/png'] };
    return wayland ? [wl, x11] : [x11];
  }
  return [];
}

export async function writeImageClipboard(png: Buffer, signal: AbortSignal): Promise<void> {
  for (const spec of imageClipboardCommands(process.platform, Boolean(process.env.WAYLAND_DISPLAY))) {
    try {
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) { reject(new Error('cancelled')); return; }
        const child = spawn(spec.command, spec.args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
        let settled = false;
        const abort = () => { child.kill(); finish(new Error('cancelled')); };
        const timer = setTimeout(() => { child.kill(); finish(new Error('clipboard-timeout')); }, 10_000);
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          child.stdin.destroy(); child.stderr.destroy();
          if (error) reject(error); else resolve();
        };
        signal.addEventListener('abort', abort, { once: true });
        child.once('error', finish);
        // Linux 工具派生剪贴板持有者；等待父进程 exit，不等待守护进程关闭管道。
        child.once('exit', code => finish(code === 0 ? undefined : new Error('clipboard-write-failed')));
        child.stderr.resume();
        child.stdin.on('error', () => { /* 提前退出由 error/exit 统一处理。 */ });
        child.stdin.end(png);
      });
      return;
    } catch (error) {
      if (signal.aborted || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error('clipboard-unavailable');
}
