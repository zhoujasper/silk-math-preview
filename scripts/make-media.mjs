/**
 * 用真实渲染管线生成 README 里的功能示意图。
 * 公式部分是 MathJax 的真实输出，外层编辑器窗框是示意，不冒充实机截图。
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { Worker } from 'node:worker_threads';

const run = promisify(execFile);

/** Marketplace 的 README 不渲染 SVG，示意图必须交付 PNG。 */
const BROWSERS = [
  process.env.SILK_MATH_CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter((path) => typeof path === 'string' && existsSync(path));

async function rasterize(svgMarkup, width, height, target) {
  const browser = BROWSERS[0];
  if (!browser) {
    console.warn(`未找到 Chrome/Edge，跳过 ${target} 的 PNG 生成`);
    return false;
  }
  const directory = await mkdtemp(join(tmpdir(), 'silk-media-'));
  const page = join(directory, 'page.html');
  try {
    await writeFile(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}</style>${svgMarkup}`, 'utf8');
    await run(browser, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1.5',
      '--default-background-color=00000000',
      `--window-size=${Math.ceil(width)},${Math.ceil(height)}`,
      `--screenshot=${resolve(target)}`,
      `file://${page.replace(/\\/g, '/')}`,
    ], { timeout: 60_000 });
    return true;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const workerPath = resolve(process.env.SILK_MATH_WORKER ?? 'dist/render-worker.js');

const THEME = {
  background: '#1f2430',
  panel: '#282d3a',
  panelBorder: '#3a4152',
  gutter: '#4b5263',
  text: '#d7dae0',
  comment: '#7c8497',
  command: '#7aa2f7',
  brace: '#c8a45c',
  string: '#9ece6a',
  caret: '#ffb454',
  accent: '#8ab4f8',
};

function createClient() {
  const worker = new Worker(workerPath);
  const pending = new Map();
  let nextId = 1;
  worker.on('message', (message) => {
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  });
  const render = (input) => new Promise((resolvePromise, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => reject(new Error('render timeout')), 20_000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      if (!message.ok) reject(new Error(message.error));
      else resolvePromise(message);
    });
    worker.postMessage({
      type: 'render',
      id,
      displayMode: true,
      definitionFingerprint: input.fingerprint ?? 'media',
      definitionPrelude: input.prelude ?? '',
      foreground: THEME.text,
      caretColor: THEME.caret,
      scale: input.scale ?? 1,
      exPx: 8.4,
      expression: input.expression,
    });
  });
  return { worker, render };
}

const escapeXml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** 把源码行按 TeX 词法着色，纯展示用。 */
function sourceLine(text, x, y) {
  const spans = [];
  const pattern = /(\\[A-Za-z@]+|\$+|[{}[\]]|%[^\n]*|[^\\${}[\]%]+)/g;
  let cursor = x;
  for (const [token] of text.matchAll(pattern)) {
    let fill = THEME.text;
    if (token.startsWith('\\')) fill = THEME.command;
    else if (token.startsWith('%')) fill = THEME.comment;
    else if (token === '$' || token === '$$') fill = THEME.string;
    else if (/^[{}[\]]$/.test(token)) fill = THEME.brace;
    spans.push(`<tspan fill="${fill}">${escapeXml(token)}</tspan>`);
  }
  void cursor;
  // tspan 顺序排布，宽度交给渲染器；手工累加字符宽度会让中英文混排重叠。
  return `<text x="${x}" y="${y}" xml:space="preserve" font-family="Consolas, 'Microsoft YaHei', monospace" font-size="13">${spans.join('')}</text>`;
}

/** 内嵌 MathJax SVG：去掉 XML 头并按指定位置摆放。 */
function embed(svg, x, y) {
  const inner = svg.replace(/^<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  const attributes = /^<svg\b([^>]*)>/i.exec(svg)?.[1] ?? '';
  const width = /\bwidth="([\d.]+)px"/.exec(attributes)?.[1] ?? '100';
  const height = /\bheight="([\d.]+)px"/.exec(attributes)?.[1] ?? '20';
  const viewBox = /\bviewBox="([^"]+)"/.exec(attributes)?.[1] ?? '0 0 100 20';
  return {
    width: Number(width),
    height: Number(height),
    markup: `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMinYMid meet" overflow="visible" style="color:${THEME.text}">${inner}</svg>`,
  };
}

function frame({ title, width, height, lines, panels }) {
  const rows = lines.map((line, index) => sourceLine(line, 58, 74 + index * 22)).join('');
  const gutter = lines
    .map((_, index) => `<text x="40" y="${74 + index * 22}" text-anchor="end" font-family="Consolas, monospace" font-size="12" fill="${THEME.gutter}">${index + 1}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
  <rect width="${width}" height="${height}" rx="10" fill="${THEME.background}"/>
  <rect x="0" y="0" width="${width}" height="34" rx="10" fill="#171b26"/>
  <rect x="0" y="24" width="${width}" height="10" fill="#171b26"/>
  <circle cx="20" cy="17" r="5" fill="#e06c75"/><circle cx="38" cy="17" r="5" fill="#e5c07b"/><circle cx="56" cy="17" r="5" fill="#98c379"/>
  <text x="78" y="21" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" fill="${THEME.comment}">${escapeXml(title)}</text>
  ${gutter}${rows}${panels}
</svg>`;
}

/** 浮层面板：与扩展里的样式一致（圆角、阴影、hover 背景）。 */
function panel(x, y, content) {
  const padding = 9;
  const width = content.width + padding * 2;
  const height = content.height + padding * 2;
  return `<g>
    <rect x="${x}" y="${y}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="8" fill="${THEME.panel}" stroke="${THEME.panelBorder}"/>
    ${content.markup.replace(/^<svg x="[\d.]+" y="[\d.]+"/, `<svg x="${(x + padding).toFixed(1)}" y="${(y + padding).toFixed(1)}"`)}
  </g>`;
}

const frameHeight = (lines, panelTop, panelHeight) => Math.ceil(Math.max(74 + lines * 22, panelTop + panelHeight + 18) + 14);

const CARET = String.raw`\class{silk-math-caret}{\rule[-0.18em]{0.03em}{0.92em}}`;

async function emit(name, markup, width, height) {
  await writeFile(`media/${name}.svg`, markup, 'utf8');
  const ok = await rasterize(markup, width, height, `media/${name}.png`);
  return ok ? `${name}.png` : `${name}.svg`;
}

/**
 * 示意图只生成 PNG。README 用相对路径 `media/*.png`，打包时由 vsce 改写成
 * GitHub https 地址。详情页 sanitizer 只放行 http/https，data URI 和相对路径都会被剥掉。
 */

async function main() {
  const { worker, render } = createClient();
  try {
    // 1. 行内公式 + 源码同步光标
    const inline = await render({
      expression: String.raw`E(u)=\int_\Omega|\nabla u|^2\,${CARET}\mathrm{d}x`,
      fingerprint: 'media-inline',
    });
    const inlineContent = embed(inline.svg, 0, 0);
    const INLINE_HEIGHT = frameHeight(2, 108, inlineContent.height + 18);
    const inlineFrame = frame({
      title: 'notes.md — 行内公式与源码同步光标',
      width: 720,
      height: INLINE_HEIGHT,
      lines: [
        '相场稳态解为 $u\\equiv-1$，能量为',
        '$E(u)=\\int_\\Omega |\\nabla u|^2\\,dx$。',
      ],
      panels: panel(58, 108, inlineContent),
    });
    await emit('preview-live-caret', inlineFrame, 720, INLINE_HEIGHT);

    // 2. 自定义宏与颜色（来自 .sty / .cls）
    const macros = await render({
      expression: String.raw`\bigl(e^{hL}u\bigr)(x)=\int_{\R^d}\frac{\textcolor{Accent}{u(y)}}{(4\pi\eps^2h)^{d/2}}${CARET}\,\dd y`,
      prelude: [
        String.raw`\definecolor{Accent}{rgb}{0.42,0.65,0.98}`,
        String.raw`\def\R{\mathbb{R}}`,
        String.raw`\def\eps{\varepsilon}`,
        String.raw`\def\dd{\mathrm{d}}`,
      ].join('\n'),
      fingerprint: 'media-macros',
    });
    const macroContent = embed(macros.svg, 0, 0);
    const MACRO_HEIGHT = frameHeight(4, 150, macroContent.height + 18);
    const macroFrame = frame({
      title: 'paper.tex — 工作区 .sty / .cls 里的宏、环境与颜色',
      width: 760,
      height: MACRO_HEIGHT,
      lines: [
        '% mymath.sty: \\newcommand{\\eps}{\\varepsilon}  \\definecolor{Accent}{HTML}{6BA6FA}',
        '\\begin{equation}',
        '  \\bigl(e^{hL}u\\bigr)(x)=\\int_{\\R^d}\\frac{\\textcolor{Accent}{u(y)}}{(4\\pi\\eps^2h)^{d/2}}\\,\\dd y',
        '\\end{equation}',
      ],
      panels: panel(58, 150, macroContent),
    });
    await emit('preview-definitions', macroFrame, 760, MACRO_HEIGHT);

    // 3. 表格环境
    const table = await render({
      expression: String.raw`\begin{array}{ccc}\hline \text{方法} & \text{$L^2$ 误差} & \text{阶}\\\hline \text{Crank-Nicolson} & \text{$3.1\times10^{-4}$} & \text{$2.00$}\\ \text{Backward Euler} & \text{$1.7\times10^{-2}$} & \text{$1.01$}\\\hline\end{array}`,
      scale: 0.82,
      fingerprint: 'media-table',
    });
    const tableContent = embed(table.svg, 0, 0);
    const TABLE_HEIGHT = frameHeight(7, 212, tableContent.height + 18);
    const tableFrame = frame({
      title: 'paper.tex — tabular / longtable 也能预览',
      width: 760,
      height: TABLE_HEIGHT,
      lines: [
        '\\begin{tabular}{ccc}',
        '  \\toprule',
        '  方法 & $L^2$ 误差 & 阶 \\\\',
        '  \\midrule',
        '  Crank-Nicolson & $3.1\\times10^{-4}$ & $2.00$ \\\\',
        '  \\bottomrule',
        '\\end{tabular}',
      ],
      panels: panel(58, 212, tableContent),
    });
    await emit('preview-table', tableFrame, 760, TABLE_HEIGHT);

    // 4. OCR：识别结果同样用真实渲染
    const ocr = await render({
      expression: String.raw`\mathbf{x}^{2}+\mathbf{y}^{2}=\mathbf{z}^{2}`,
      fingerprint: 'media-ocr',
    });
    const ocrContent = embed(ocr.svg, 0, 0);
    const ocrWidth = 640;
    const ocrHeight = Math.ceil(156 + ocrContent.height + 18 + 14);
    const ocrFrame = `<svg xmlns="http://www.w3.org/2000/svg" width="${ocrWidth}" height="${ocrHeight}" viewBox="0 0 ${ocrWidth} ${ocrHeight}" role="img" aria-label="按需本地截图识别">
  <rect width="${ocrWidth}" height="${ocrHeight}" rx="10" fill="${THEME.background}"/>
  <rect x="0" y="0" width="${ocrWidth}" height="34" rx="10" fill="#171b26"/>
  <rect x="0" y="24" width="${ocrWidth}" height="10" fill="#171b26"/>
  <text x="20" y="21" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" fill="${THEME.comment}">Silk Math · 截图识别（本地运行，不上传）</text>
  <rect x="24" y="52" width="${ocrWidth - 48}" height="52" rx="8" fill="#11141c" stroke="${THEME.accent}" stroke-dasharray="5 4"/>
  <text x="40" y="83" font-family="'Segoe UI', system-ui, sans-serif" font-size="13" fill="${THEME.comment}">框选屏幕上的公式 →  识别为 LaTeX  →  可编辑后插入光标处</text>
  <rect x="24" y="118" width="${ocrWidth - 48}" height="30" rx="6" fill="#11141c"/>
  <text x="36" y="138" font-family="Consolas, monospace" font-size="13" fill="${THEME.string}">\\mathbf{x}^{2}+\\mathbf{y}^{2}=\\mathbf{z}^{2}</text>
  ${panel(24, 156, ocrContent)}
</svg>`;
    await emit('preview-ocr', ocrFrame, ocrWidth, ocrHeight);

    console.log(JSON.stringify({
      inline: `${inline.widthPx}x${inline.heightPx}`,
      macros: `${macros.widthPx}x${macros.heightPx}`,
      table: `${table.widthPx}x${table.heightPx}`,
      ocr: `${ocr.widthPx}x${ocr.heightPx}`,
    }, null, 2));
  } finally {
    await worker.terminate();
  }
}

await main();
