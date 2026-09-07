import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findMathRegionAt, scanMathRegions } from '../src/core/mathScanner';
import { containsTikz, extractTikzPreamble, prepareTikzSource, tikzDocument, tikzSetup } from '../src/tikz/source';
import { readTar } from '../src/tikz/tar';
import { tikzContextEnd } from '../src/tikz/context';

export const AXIS_SOURCE = String.raw`\begin{tikzpicture}
\begin{axis}[width=8cm,height=4cm,xlabel={$x$},ylabel={$x^2$},grid=major]
&#x20; \addplot[blue,thick,domain=0:2,samples=30]{x^2};
\end{axis}
\end{tikzpicture}`;

describe('TikZ source and settings', () => {
  it('preserves native definitions before a picture, including display-math wrappers', () => {
    const result = prepareTikzSource(String.raw`$$\def\radius{2}` + AXIS_SOURCE + '$$');
    expect(result).toContain(String.raw`\def\radius{2}`);
    expect(result.indexOf('\\def')).toBeLessThan(result.indexOf('\\begin{tikzpicture}'));
    expect(result).not.toContain('$$');
  });

  it('keeps definition order, delimited parameters, scopes and conditional branches', () => {
    const context = extractTikzPreamble(String.raw`\def\a{1}\edef\b{\a}\def\a{2}
{\gdef\pair#1,#2;{(#1,#2)}}\let\saved=\a
\iffalse\def\a{9}\else\def\a{3}\fi
\begingroup\def\a{4}`);
    expect(context).toContain(String.raw`\edef\b{\a}`);
    expect(context.indexOf('\\edef')).toBeLessThan(context.indexOf(String.raw`\def\a{2}`));
    expect(context).toContain(String.raw`\gdef\pair#1,#2;{(#1,#2)}`);
    expect(context).toContain(String.raw`\let\saved=\a`);
    expect(tikzContextEnd(context)).toBe('\\endgroup\n');
    expect(tikzContextEnd(String.raw`\def\open{\begingroup}`)).toBe('');
  });

  it('ignores displayed definitions in verbatim text and never executes a macro body while collecting it', () => {
    const context = extractTikzPreamble(String.raw`\texttt{\def\hidden{9}}
\begin{verbatim}\def\hidden{8}\end{verbatim}
\def\setup{\def\radius{7}}\def\radius{2}`);
    expect(context).not.toContain('hidden');
    expect(context).toContain(String.raw`\def\setup{\def\radius{7}}`);
    expect(context.match(/\\def\\radius\{7\}/g)).toHaveLength(1);
  });

  it.each(['latex', 'markdown'] as const)('recognizes the whole picture before its math labels in %s', (language) => {
    const source = language === 'markdown' ? '```tikz\n' + AXIS_SOURCE + '\n```\n$z$' : AXIS_SOURCE + '\n$z$';
    const scan = scanMathRegions(source, { language });
    const picture = findMathRegionAt(scan.regions, source.indexOf('addplot'));
    expect(picture?.environment).toBe('tikzpicture');
    expect(findMathRegionAt(scan.regions, source.indexOf('$x$'))).toBe(picture);
    expect(scan.regions).toHaveLength(2);
  });

  it('handles a picture inside display delimiters and HTML space artifacts without editing the input', () => {
    const result = prepareTikzSource(`$$\n${AXIS_SOURCE}\n$$`);
    expect(result).toContain(' \addplot'.replace('addplot', '\\addplot'));
    expect(result).not.toContain('&#x20;');
    expect(result).not.toContain('$$');
    expect(AXIS_SOURCE).toContain('&#x20;');
    expect(prepareTikzSource(AXIS_SOURCE.replace('&#x20;', '&#32;&nbsp;&#160;'))).not.toContain('&');
  });

  it('recovers missing closing environments and ignores commented end commands', () => {
    const input = String.raw`\begin{tikzpicture}
% \end{tikzpicture}
\begin{axis}\addplot{x^2};`;
    expect(prepareTikzSource(input)).toContain('\\end{axis}\n\\end{tikzpicture}');
    expect(containsTikz('% ' + AXIS_SOURCE.split('\n')[0])).toBe(false);
    expect(() => prepareTikzSource('$x$')).toThrow('No TikZ picture');
    expect(() => prepareTikzSource('\\begin{tikzpicture}\\end{axis}')).toThrow('Mismatched');
  });

  it('inherits nested styles and library settings without copying the document body or file inputs', () => {
    const source = String.raw`\documentclass{article}
% \usetikzlibrary{external}
\usetikzlibrary{arrows.meta,calc}
\tikzset{box/.style={draw,label={hello}}}
\usepgfplotslibrary{groupplots}
\input{private.tex}
\begin{document}body`;
    const prelude = extractTikzPreamble(source);
    expect(prelude).toContain('box/.style={draw,label={hello}}');
    expect(prelude).toContain('arrows.meta,calc');
    expect(prelude).toContain('groupplots');
    expect(prelude).not.toMatch(/document|private|external/);
    expect(extractTikzPreamble('\\tikzset{unfinished')).toBe('');
  });

  it('automatically loads pgfplots, tikz-cd and circuitikz only where needed', () => {
    expect(tikzDocument(AXIS_SOURCE, '')).toContain('\\usepackage{pgfplots}');
    expect(tikzDocument('\\begin{tikzpicture}\\draw(0,0)--(1,1);\\end{tikzpicture}', '')).not.toContain('pgfplots');
    expect(tikzDocument('\\begin{tikzcd}x\\end{tikzcd}', '')).toContain('\\usepackage{tikz-cd}');
    expect(tikzDocument('\\begin{circuitikz}\\end{circuitikz}', '')).toContain('\\usepackage{circuitikz}');
  });

  it('respects explicit compatibility, package options and standalone package declarations', () => {
    const circuit = tikzDocument('\\begin{circuitikz}\\end{circuitikz}', String.raw`\usepackage[american]{circuitikz}`);
    expect(circuit.match(/\\usepackage.*\{circuitikz\}/g)).toEqual([String.raw`\usepackage[american]{circuitikz}`]);
    const document = tikzDocument(String.raw`\usepackage{pgfplots}` + AXIS_SOURCE, String.raw`\def\compat{1.18}\pgfplotsset{compat=\compat}`);
    expect(document.indexOf('\\usepackage')).toBeLessThan(document.indexOf('\\begin{document}'));
    expect(document.match(/\\usepackage\{pgfplots\}/g)).toHaveLength(1);
    expect(document).toContain(String.raw`\pgfplotsset{compat=\compat}`);
    const setup = tikzSetup(AXIS_SOURCE, String.raw`\pgfplotsset{compat=1.16}`);
    expect(setup.preamble).toContain('compat=1.18');
    expect(setup.context).toContain('compat=1.16');
  });

  it.each([['groupplot', 'groupplots'], ['polaraxis', 'polar'], ['ternaryaxis', 'ternary'], ['smithchart', 'smithchart']])('loads the library needed for %s', (environment, library) => {
    const setup = tikzSetup(`\\begin{tikzpicture}\\begin{${environment}}\\end{${environment}}\\end{tikzpicture}`, '');
    expect(setup.preamble).toContain(`\\usepgfplotslibrary{${library}}`);
  });

  it('preserves legacy styles, custom functions and in-memory plot tables', () => {
    const declarations = String.raw`\tikzstyle{box}=[draw,label={a}]
\pgfmathdeclarefunction{curve}{1}{\pgfmathparse{#1^2}}
\usepackage{pgfplotstable}
\pgfplotstableread[row sep=\\]{x y\\0 0\\1 2\\}\data`;
    const context = extractTikzPreamble(declarations);
    for (const line of declarations.split('\n')) expect(context).toContain(line);
  });

  it('loads literal libraries in the preamble and keeps dynamic names after their definitions', () => {
    const setup = tikzSetup(AXIS_SOURCE, String.raw`\usepgfplotslibrary{dateplot}\usetikzlibrary{calendar}`);
    expect(setup.context).not.toContain('library');
    expect(setup.preamble.indexOf('\\usepackage{pgfplots}')).toBeLessThan(setup.preamble.indexOf('\\usepgfplotslibrary'));
    expect(setup.preamble).toContain(String.raw`\usetikzlibrary{calendar}`);
    const dynamic = tikzSetup(AXIS_SOURCE, String.raw`\def\libs{statistics}\usepgfplotslibrary{\libs}`);
    expect(dynamic.context).toBe(String.raw`\def\libs{statistics}\usepgfplotslibrary{\libs}`);
  });

  it('does not activate packages or libraries inside conditional branches', () => {
    const context = String.raw`\iffalse\usepgfplotslibrary{missing}\usepackage{missing}\fi`;
    const setup = tikzSetup(AXIS_SOURCE, context);
    expect(setup.preamble).not.toContain('missing');
    expect(setup.context).toBe(context);
  });

  it('ships an off-by-default switch and a discoverable command in both channels', async () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(manifest.contributes.configuration.properties['silkMath.tikz.enabled'].default).toBe(false);
    expect(manifest.contributes.commands.some((command: { command: string }) => command.command === 'silkMath.toggleTikz')).toBe(true);
    // @ts-expect-error packaging helper is untyped ESM
    const { transformManifest } = await import('../scripts/channelManifest.mjs');
    const test = transformManifest(manifest, 'test');
    expect(test.contributes.configuration.properties['silkMathTest.tikz.enabled'].default).toBe(false);
    expect(test.contributes.commands.some((command: { command: string }) => command.command === 'silkMathTest.toggleTikz')).toBe(true);
  });
});

describe('bounded optional-pack archive handling', () => {
  function archive(path: string, type = '0'): Buffer {
    const tar = Buffer.alloc(1536);
    tar.write(path, 0);
    tar.write('00000000003\0', 124);
    tar.write(type, 156);
    tar.write('abc', 512);
    return tar;
  }
  it('extracts regular files and rejects traversal, links and truncated payloads', () => {
    expect(readTar(archive('package/a.js')).get('package/a.js')?.toString()).toBe('abc');
    expect(() => readTar(archive('../private'))).toThrow('path');
    expect(() => readTar(archive('/private'))).toThrow('path');
    expect(() => readTar(archive('link', '2'))).toThrow('entry');
    expect(() => readTar(archive('a').subarray(0, 513))).toThrow('archive');
  });
});
