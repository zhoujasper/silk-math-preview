import { win32 } from 'node:path';

/**
 * Windows PowerShell 5.1 的启动方式。
 *
 * - 不用 -File：无 BOM 的脚本按 ANSI 代码页（如 GBK）解码；组策略的执行策略还会覆盖 -ExecutionPolicy。
 * - 不用 -EncodedCommand：Defender ASR、AMSI 及不少企业安全软件会拦截或标记编码命令。
 * - 不用 -Command -：5.1 从标准输入逐行解析，多行 try/here-string 会被截断。
 * - -Command 文本里不放双引号：5.1 的命令行解析会吞掉引号。
 *
 * 脚本正文和参数都走环境变量（Unicode，不经代码页），由下面的短命令创建脚本块执行；
 * 执行策略只作用于脚本文件，不作用于脚本块。脚本块 return 的最后一个整数即进程退出码，
 * 不依赖 exit 在嵌套作用域中的行为。
 */
export const WINDOWS_POWERSHELL_LAUNCHER = "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; "
  + 'try { $silkResult = & ([scriptblock]::Create($env:SILK_PS_SCRIPT)); $silkCode = 0; '
  + 'foreach ($silkItem in @($silkResult)) { if ($silkItem -is [int]) { $silkCode = $silkItem } }; exit $silkCode } '
  + 'catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }';

export interface WindowsPowerShellCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

/** 扩展宿主的 PATH 可能不含系统目录，先用 Windows PowerShell 的绝对路径，再回退到 PATH。 */
export function windowsPowerShellCandidates(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  const root = env.SystemRoot ?? env.SYSTEMROOT ?? env.windir ?? env.WINDIR ?? 'C:\\Windows';
  return [win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), 'powershell.exe'];
}

export function windowsPowerShellCommands(script: string, values: Readonly<Record<string, string>> = {},
  env: NodeJS.ProcessEnv = process.env): readonly WindowsPowerShellCommand[] {
  const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-Command', WINDOWS_POWERSHELL_LAUNCHER];
  return windowsPowerShellCandidates(env).map(command => ({ command, args, env: { ...values, SILK_PS_SCRIPT: script } }));
}

/** 5.1 在重定向时可能把错误/进度写成 CLIXML；提取可读的错误文本。 */
export function readablePowerShellError(stderr: string): string {
  if (!stderr.includes('#< CLIXML')) return stderr.trim();
  const errors = [...stderr.matchAll(/<S S="Error">([\s\S]*?)<\/S>/g)].map(match => match[1]!
    .replace(/_x000D_/g, '').replace(/_x000A_/g, '\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&amp;/g, '&'));
  return errors.join('').trim() || stderr.replace(/#< CLIXML[\s\S]*$/, '').trim();
}
