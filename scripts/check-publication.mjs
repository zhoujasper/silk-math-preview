import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Keep local work notes and conversation exports out of commits, pushes and release builds.
const publicDocs = new Set(['COMPLETION.md', 'MACRO_SUPPORT.md', 'OCR_ACCURACY.md', 'PREVIEW_CSS.md', 'TIKZ.md']);
const publicRootFiles = new Set(['README.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE', '.gitignore', '.vscodeignore', '.npmrc', 'package.json', 'package-lock.json', 'tsconfig.json']);
const publicResources = new Set(['APACHE-2.0.txt', 'OCR_THIRD_PARTY_NOTICES.md', 'PNG_THIRD_PARTY_NOTICES.md', 'TIKZ_THIRD_PARTY_NOTICES.md', 'capture-windows.ps1', 'panel-icon.svg', 'read-clipboard-macos.js', 'tikz-GPL-3.0.txt', 'tikz-pgfplots-1.18.3.tar.gz']);
function privatePath(path) {
  const parts = path.toLowerCase().split('/');
  const name = parts.at(-1);
  if (parts.some(part => /^(?:tests?|coverage|node_modules|dist|internal|notes|reports|artifacts|sessions|rollout_summaries|(?:\.)?codex|\.claude|\.grok|\.local|\.tmp.*)$/.test(part))) return true;
  if (/^(?:agents|project_memory|change_logs)\.md$|^vitest\.config\./.test(name)) return true;
  if (/(?:^|[._ -])(?:codex|conversation|transcript|rollout)(?:[._ -]|$)/.test(name)) return true;
  if (/\.(?:test|spec)\.[^.]+$|\.(?:jsonl|log|cpuprofile|heapsnapshot|vsix|map)$/.test(name)) return true;
  if (/^scripts\/(?:benchmark|stress|validate)[^/]*\.[^/]+$/.test(path)) return true;
  if (parts[0] === 'docs' && (parts.length !== 2 || !publicDocs.has(path.slice(5)))) return true;
  if (parts.length === 1) return !publicRootFiles.has(path);
  if (parts[0] === 'docs') return false;
  if (parts[0] === 'src') return !/\.ts$/.test(path);
  if (parts[0] === 'scripts') return parts.length !== 2 || !/\.(?:mjs|py)$/.test(path);
  if (parts[0] === 'resources') return parts.length !== 2 || !publicResources.has(path.slice(10));
  if (parts[0] === 'media') return parts.length !== 2 || !/\.(?:png|svg|jpg|webp|gif)$/.test(path);
  if (parts[0] === '.github') return parts.length !== 3 || parts[1] !== 'workflows' || !/\.ya?ml$/.test(path);
  if (parts[0] === '.vscode') return parts.length !== 2 || !/^(?:launch|settings|tasks|extensions)\.json$/.test(name);
  return true;
}
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
function check(paths, label) {
  const banned = paths.filter(privatePath);
  if (banned.length) throw new Error(`${label}: internal files must stay local:\n${banned.join('\n')}`);
  return paths.length;
}
let count = 0;
if (process.argv.includes('--pre-push')) {
  const commits = new Set();
  for (const line of readFileSync(0, 'utf8').trim().split('\n')) {
    const [, local, , remote] = line.split(/\s+/);
    if (!local || /^0+$/.test(local)) continue;
    if (!/^[0-9a-f]{40,64}$/.test(local) || !/^[0-9a-f]{40,64}$/.test(remote ?? '')) throw new Error('Invalid pre-push input');
    // Check every new commit, including files removed again before the final commit.
    const revisions = git(['rev-list', local, '--not', '--remotes', ...(/^0+$/.test(remote) ? [] : [remote])]);
    for (const revision of revisions.trim().split('\n').filter(Boolean)) commits.add(revision);
  }
  for (const revision of commits) count += check(git(['ls-tree', '-r', '--name-only', '-z', revision]).split('\0').filter(Boolean), revision);
} else {
  const paths = process.argv.includes('--staged')
    ? git(['ls-files', '-z', '--cached'])
    : git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  count = check([...new Set(paths.split('\0').filter(Boolean))], 'Repository');
}
console.log(`Publication guard passed (${count} paths checked).`);
