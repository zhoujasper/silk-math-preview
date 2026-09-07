import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { tikzCompatibilityCases } from '../test/fixtures/tikzCompatibility.mjs';

// Real optional-package download + WebAssembly smoke, without VS Code or a browser.
// Artifacts and verified packages can be reused by subsequent offline runs.
const destination = resolve('.tmp-tikz-smoke');
await mkdir(destination, { recursive: true });
for (const [source, output] of [['src/tikz/pack.ts', 'pack'], ['src/render/renderClient.ts', 'client'], ['src/tikz/context.ts', 'context']]) {
  await build({ entryPoints: [source], outfile: `${destination}/${output}.mjs`, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
}
const { ensureTikzPack } = await import(pathToFileURL(`${destination}/pack.mjs`).href);
const { RenderClient } = await import(pathToFileURL(`${destination}/client.mjs`).href);
const { extractTikzPreamble } = await import(pathToFileURL(`${destination}/context.mjs`).href);
const packRoot = await ensureTikzPack(`${destination}/runtime`, new AbortController().signal, (message) => console.log(`TikZ pack: ${message}`));
const client = new RenderClient(resolve(process.argv[2] ?? 'dist/tikz-worker.js'), 100, { workerData: { packRoot }, timeoutMs: 1800 });
const fixture = await readFile('test/fixtures/manual/tikz.tex', 'utf8');
const axis = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/.exec(fixture)[0];
const input = (expression, definitionPrelude = '') => ({ expression, definitionPrelude, definitionFingerprint: '', displayMode: true, foreground: '#000', caretColor: '', scale: 1, exPx: 0, markUnknownCommands: false });
const results = [];
try {
  for (const [name, source, prelude = ''] of [
    ['axis', axis.replace('  \\addplot', '&#x20; \\addplot')],
    ['edited', axis.replace('{x^2};', '{x^3};')],
    ['incomplete', axis.replace('\\end{axis}', '').replace('\\end{tikzpicture}', '')],
    ['nodes', String.raw`\begin{tikzpicture}\draw[blue,thick,-{Stealth}] (0,0)--(3,1);\node[draw,circle] at (1,1) {$\Omega+x^2$};\end{tikzpicture}`, String.raw`\usetikzlibrary{arrows.meta}`],
    ['macro', String.raw`\begin{tikzpicture}\draw (0,0)--(\length,1);\node at (1,0) {A \& B};\end{tikzpicture}`, String.raw`\def\length{2}`],
  ]) {
    const response = await client.render(input(source, prelude));
    assert.equal(response.ok, true, `${name}: ${response.error}`);
    assert(response.svg.includes('<path'));
    assert(!response.svg.includes('<text'));
    assert(!response.svg.includes('font-family'));
    assert(!/(?:href|src)="(?:https?:|file:)/.test(response.svg));
    await writeFile(`${destination}/${name}.svg`, response.svg);
    results.push({ name, width: response.widthPx, height: response.heightPx, bytes: response.svg.length, ms: response.renderMs });
  }
  assert.notEqual(await readFile(`${destination}/axis.svg`, 'utf8'), await readFile(`${destination}/edited.svg`, 'utf8'));
  const s = String.raw;
  const picture = (body) => s`\begin{tikzpicture}` + body + s`\end{tikzpicture}`;
  const cases=[
 ['edef-order',s`\def\radius{1}\edef\saved{\radius}\def\radius{2}`,s`\draw(0,0)--(\saved,\radius);`,s`\draw(0,0)--(1,2);`],
 ['delimited-def',s`\def\pair#1,#2;{(#1,#2)}`,s`\draw(0,0)--\pair2,1;;`,s`\draw(0,0)--(2,1);`],
 ['let',s`\def\radius{1}\let\saved=\radius\def\radius{2}`,s`\draw(0,0)--(\saved,\radius);`,s`\draw(0,0)--(1,2);`],
 ['closed-group',s`\def\radius{2}{\def\radius{9}}`,s`\draw(0,0)--(\radius,1);`,s`\draw(0,0)--(2,1);`],
 ['open-group',s`\def\radius{2}\begingroup\def\radius{3}`,s`\draw(0,0)--(\radius,1);`,s`\draw(0,0)--(3,1);`],
 ['global',s`\def\radius{2}{\global\def\radius{3}}`,s`\draw(0,0)--(\radius,1);`,s`\draw(0,0)--(3,1);`],
 ['previous-picture',s`\def\radius{2}\begin{tikzpicture}\def\radius{9}\draw(0,0)--(1,1);\end{tikzpicture}`,s`\draw(0,0)--(\radius,1);`,s`\draw(0,0)--(2,1);`],
 ['macro-body',s`\def\setup{\def\radius{9}}\def\radius{2}`,s`\draw(0,0)--(\radius,1);`,s`\draw(0,0)--(2,1);`],
 ['conditional',s`\def\radius{2}\iffalse\def\radius{9}\else\def\radius{3}\fi`,s`\draw(0,0)--(\radius,1);`,s`\draw(0,0)--(3,1);`],
 ['multiline-conditional',s`\def\radius{2}
\ifdefined\radius
\def\radius{3}
\else
\def\radius{9}
\fi`,s`\draw(0,0)--(\radius,1);`,s`\draw(0,0)--(3,1);`],
 ['new-renew',s`\newcommand{\radius}{2}\renewcommand{\radius}{3}`,s`\draw(0,0)--(\radius,1);`,s`\draw(0,0)--(3,1);`],
 ['pgfmathmacro',s`\pgfmathsetmacro{\radius}{1+2}`,s`\draw(0,0)--(\radius,1);`,s`\draw(0,0)--(3,1);`],
 ['definition-in-picture','',s`\def\radius{3}\draw(0,0)--(\radius,1);`,s`\draw(0,0)--(3,1);`],
];
  for (const [name, context, body, expected] of cases) {
    const actual = await client.render(input(picture(body), extractTikzPreamble(context)));
    const reference = await client.render(input(picture(expected)));
    assert.equal(actual.ok, true, `${name}: ${actual.error}`);
    assert.equal(actual.svg, reference.svg, `${name}: rendered geometry/text differs`);
  }
  const prelude = s`\def\radius{2}`;
  const altered = await client.render(input(picture(s`\gdef\radius{9}\draw(0,0)--(\radius,1);`), prelude));
  const restored = await client.render(input(picture(s`\draw(0,0)--(\radius,1);`), prelude));
  assert.equal(restored.svg, (await client.render(input(picture(s`\draw(0,0)--(2,1);`)))).svg);
  assert.notEqual(restored.svg, altered.svg);
  assert.equal((await client.render(input(s`$$\def\radius{2}` + picture(s`\draw(0,0)--(\radius,1);`) + '$$'))).svg, restored.svg);
  const macroAxis = await client.render(input(axis.replace('{x^2};', '{\\curve};'), s`\def\curve{x^2}`));
  assert.equal(macroAxis.svg, (await client.render(input(axis))).svg, 'pgfplots must expand the curve definition');
  const compat18 = await client.render(input(axis, s`\pgfplotsset{compat=1.18}`));
  assert.equal(compat18.ok, true, compat18.error);
  for (const compat of ['1.16', '1.17', '1.18', 'newest']) {
    const response = await client.render(input(axis, `\\pgfplotsset{compat=${compat}}`));
    assert.equal(response.ok, true, `${compat}: ${response.error}`);
    if (compat === 'newest') assert.equal(response.svg, compat18.svg);
  }
  assert.equal((await client.render(input(axis, s`\def\version{1.18}\pgfplotsset{compat=\version}`))).svg, compat18.svg);
  assert.equal((await client.render(input(axis, s`\iffalse\usepgfplotslibrary{silkNonexistent}\fi\pgfplotsset{compat=1.18}`))).svg, compat18.svg);
  assert.equal((await client.render(input(s`\usepackage{pgfplots}\pgfplotsset{compat=1.18}` + axis))).svg, compat18.svg);
  await writeFile(`${destination}/compat-1.18.svg`, compat18.svg);
  for (const [name, expression, prelude = ''] of tikzCompatibilityCases) {
    const response = await client.render(input(expression, prelude));
    assert.equal(response.ok, true, `${name}: ${response.error}`);
    assert(response.svg.includes('<path'), `${name}: missing geometry`);
    assert(response.widthPx > 0 && response.heightPx > 0);
    if (name === 'patterns') {
      assert(response.svg.includes('<symbol'));
      assert(response.svg.includes('patternUnits="userSpaceOnUse"'));
      assert.equal((await client.render(input(expression, prelude))).svg, response.svg, 'cached pattern frames must retain their definitions');
    }
    if (name === 'shading') assert.match(response.svg, /<rect[^>]+fill="url\(#pgfsh/);
    await writeFile(`${destination}/${name}.svg`, response.svg);
    results.push({ name, width: response.widthPx, height: response.heightPx, bytes: response.svg.length, ms: response.renderMs });
  }
  for (const [name, expression, prelude] of [
    ['commutative', s`\begin {tikzcd} A \arrow[r] & B \end{tikzcd}`, ''],
    ['circuit', s`\begin{circuitikz}\draw(0,0) to[R=$R$] (2,0);\end{circuitikz}`, ''],
    ['three-dimensional', picture(s`\begin{axis}[width=5cm,height=4cm]\addplot3 coordinates {(0,0,0) (1,2,3) (2,1,2)};\end{axis}`), ''],
  ]) {
    const response = await client.render(input(expression, prelude));
    assert.equal(response.ok, true, `${name}: ${response.error}`);
    assert(response.svg.includes('<path'));
  }
  const unavailable = await client.render(input(axis, s`\usepgfplotslibrary{silkNonexistent}`));
  assert.equal(unavailable.ok, false);
  assert.match(unavailable.error, /silkNonexistent/);
  for (const [name, expression, prelude, reason] of [
    ['unsupported-driver', picture(s`\fill[path fading=east] (0,0) rectangle(2,1);`), s`\usetikzlibrary{fadings}`, /fadings/],
    ['missing-glyph', picture(s`\node{\nullfont A};`), '', /no A in font nullfont/],
    ['unknown-compatibility', axis, s`\pgfplotsset{compat=1.99}`, /compat=1.99.*unknown/],
  ]) {
    const response = await client.render(input(expression, prelude));
    assert.equal(response.ok, false, `${name}: must not return an incomplete picture`);
    assert.match(response.error, reason);
    assert.equal((await client.render(input(axis))).ok, true, `${name}: next picture must recover`);
  }
  const priorStarts = client.stats().workerStarts;
  const failure = await client.render(input(String.raw`\begin{tikzpicture}\notARealTikzCommand\end{tikzpicture}`));
  assert.equal(failure.ok, false);
  assert.equal((await client.render(input(axis))).ok, true);
  assert.equal(client.stats().workerStarts, priorStarts, 'syntax errors must retain the clean checkpoint');
  const longLine = await client.render(input(picture('\\node {' + 'x'.repeat(100_000) + '};')));
  assert.equal(longLine.ok, false, 'oversized TeX lines must fail within the resource bound');
  assert.equal((await client.render(input(axis))).ok, true, 'host I/O errors must restore a clean checkpoint');
  assert.equal(client.stats().workerStarts, priorStarts);
  const manyFiles = await client.render(input(picture(s`\newcount\n\n=0\loop\openin0=tex.pool\closein0\advance\n by1\ifnum\n<5000\repeat\draw(0,0)--(1,1);`)));
  assert.equal(manyFiles.ok, false);
  assert.match(manyFiles.error, /file limit/);
  assert.equal((await client.render(input(axis))).ok, true);
  assert.equal(client.stats().workerStarts, priorStarts);
  await new Promise((resolve) => setTimeout(resolve, 160));
  const starts = client.stats().workerStarts;
  assert.equal((await client.render(input(axis))).ok, true);
  assert.equal(client.stats().workerStarts, starts + 1);
  await assert.rejects(client.render(input(String.raw`\begin{tikzpicture}\loop\iftrue\repeat\end{tikzpicture}`)), /timed out/);
  assert.equal((await client.render(input(axis))).ok, true);
  const report = { samples: results, nativeDefinitionCases: cases.length + 3, additionalPictureKinds: 3, compatibilityCases: tikzCompatibilityCases.length + 8, rejectedIncompletePictures: 3, unavailableLibraryReported: 'silkNonexistent', errorRecovery: true, ioErrorRecovery: true, fileLimitRecovery: true, idleRestart: true, timeoutRecovery: true, stats: client.stats() };
  await writeFile(`${destination}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await client.dispose(); }
