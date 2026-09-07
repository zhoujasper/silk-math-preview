// SPDX-License-Identifier: GPL-3.0-or-later
// Optional TikZ worker adapter; see resources/TIKZ_THIRD_PARTY_NOTICES.md.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import { DOMParser, XMLSerializer, type Element, type Node } from '@xmldom/xmldom';
import { parse, type Font } from 'opentype.js';
import { readTar } from './tar';
import { prepareTikzSource, tikzSetup } from './source';
import { checkpointModule, TexRuntime } from './texRuntime';
import { extractTikzPreamble, tikzContextEnd } from './context';
import { compactIntersectionFrames, loadTikzLibraries } from './libraries';

const unzip = promisify(gunzip);
const SVG_NS = 'http://www.w3.org/2000/svg';
const ALLOWED_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'symbol', 'clipPath', 'linearGradient', 'radialGradient', 'stop', 'pattern', 'mask', 'use', 'title', 'desc']);
const PRESENTATION = /^(?:fill(?:-opacity|-rule)?|stroke(?:-width|-opacity|-dasharray|-dashoffset|-linecap|-linejoin|-miterlimit)?|opacity|color|stop-color|stop-opacity|clip-path|clip-rule|mask|visibility|display)$/;
const INHERITED_PAINT = /^(?:fill(?:-opacity|-rule)?|stroke(?:-width|-opacity|-dasharray|-dashoffset|-linecap|-linejoin|-miterlimit)?|color)$/;

function descendants(root: Element): Element[] {
  const result: Element[] = [], pending = [root];
  for (let element = pending.pop(); element; element = pending.pop()) {
    result.push(element);
    const children = Array.from(element.childNodes).filter((child) => child.nodeType === 1) as Element[];
    for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]!);
  }
  return result;
}

function flattenPaint(root: Element): Element {
  const document = root.ownerDocument!;
  const replacement = root.cloneNode(false) as Element;
  const pending: { node: Node; parent: Node; paint: Record<string, string> }[] = [];
  const enqueue = (node: Node, parent: Node, paint: Record<string, string>): void => {
    for (let child = node.lastChild; child; child = child.previousSibling) pending.push({ node: child, parent, paint });
  };
  enqueue(root, replacement, {});
  for (let item = pending.pop(); item; item = pending.pop()) {
    const { node, parent, paint } = item;
    const element = node.nodeType === 1 ? node as Element : undefined;
    if (element?.tagName === 'g' && Array.from(element.attributes).every((attribute) => INHERITED_PAINT.test(attribute.name))) {
      const inherited = { ...paint };
      for (const attribute of Array.from(element.attributes)) if (attribute.value !== 'inherit') inherited[attribute.name] = attribute.value;
      enqueue(node, parent, inherited);
    } else {
      const copy = node.cloneNode(false);
      if (element) for (const [name, value] of Object.entries(paint)) {
        const child = copy as Element;
        if (!child.hasAttribute(name) || child.getAttribute(name) === 'inherit') child.setAttribute(name, value);
      }
      parent.appendChild(copy);
      enqueue(node, copy, {});
    }
  }
  document.replaceChild(replacement, root);
  return replacement;
}

/** 真正 TeX 只看内存里的包文件，没有宿主文件系统、shell 或网络接口。 */
export class TikzEngine {
  private readonly runtimeRequire: NodeRequire;
  private resources: Promise<TexRuntime> | undefined;
  private readonly fonts = new Map<string, Font>();

  constructor(private readonly root: string, private readonly libraryPath?: string) {
    this.runtimeRequire = createRequire(join(root, 'tikz-runtime.cjs'));
  }

  private load(): Promise<TexRuntime> {
    return this.resources ??= (async () => {
      const directory = join(this.root, 'node_modules/node-tikzjax/tex');
      const [wasm, archive] = await Promise.all(['tex.wasm.gz', 'tex_files.tar.gz'].map(async (name) => unzip(await readFile(join(directory, name)), { maxOutputLength: 32 * 1024 * 1024 })));
      const { tfmData } = this.runtimeRequire('@prinsss/dvi2html') as typeof import('@prinsss/dvi2html');
      const packages = readTar(archive!);
      // Overlay the full version atomically; never mix old pgfplots core files with new libraries.
      for (const [name, data] of await loadTikzLibraries(this.libraryPath)) packages.set(name, data);
      const intersections = 'pgflibraryintersections.code.tex';
      packages.set(intersections, compactIntersectionFrames(packages.get(intersections)!));
      const runtime = new TexRuntime(packages, tfmData);
      await runtime.initialize(await WebAssembly.compile(new Uint8Array(checkpointModule(wasm!))), join(directory, 'core.dump.gz'));
      return runtime;
    })();
  }

  async render(expression: string, prelude: string, scale: number): Promise<{ svg: string; widthPx: number; heightPx: number }> {
    if (expression.length + prelude.length > 200_000) throw new Error('TikZ source is too large');
    const runtime = await this.load();
    const source = prepareTikzSource(expression);
    const { preamble, context, expression: picture } = tikzSetup(source, extractTikzPreamble(prelude));
    const dvi = runtime.render(preamble, picture + '\n' + tikzContextEnd(context), context);
    const { dvi2html } = this.runtimeRequire('@prinsss/dvi2html') as typeof import('@prinsss/dvi2html');
    let html = '';
    await dvi2html((async function* () { yield dvi; })(), {
      write(chunk: string) {
        html += chunk;
        if (html.length > 2 * 1024 * 1024) throw new Error('TikZ SVG is too large');
      },
    });
    return this.finishSvg(html, scale);
  }

  private async font(name: string): Promise<Font> {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid TikZ font');
    let font = this.fonts.get(name);
    if (!font) {
      const bytes = await readFile(join(this.root, 'node_modules/node-tikzjax/css/bakoma/ttf', `${name}.ttf`));
      font = parse(new Uint8Array(bytes).buffer);
      if (this.fonts.size >= 16) this.fonts.delete(this.fonts.keys().next().value!);
      this.fonts.set(name, font);
    }
    return font;
  }

  private async finishSvg(html: string, scale: number): Promise<{ svg: string; widthPx: number; heightPx: number }> {
    const start = html.indexOf('<svg ');
    const end = html.lastIndexOf('</svg>');
    if (start < 0) throw new Error('TikZ produced no picture');
    // The DVI converter emits HTML fragments and may omit the outer SVG end tag.
    // Close that single root explicitly instead of relying on a browser HTML parser.
    const source = (html.slice(start, end < start ? html.length : end + 6) + (end < start ? '</svg>' : ''))
      .replaceAll('&#173;', '&#172;')
      .replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g, (_match, open: string, label: string, close: string) => open
        + label.replace(/&(?!(?:#\d+|#x[\da-f]+|amp|lt|gt|quot|apos);)/gi, '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') + close);
    const document = new DOMParser({ onError: (level, message) => { if (level !== 'warning') throw new Error(message); } }).parseFromString(source, 'image/svg+xml');
    let svg = document.documentElement!;
    // Preserve PGF paint styles as standalone presentation attributes before sanitizing.
    // Removing style wholesale turns gradients into black rectangles.
    for (const element of descendants(svg)) {
      for (const rule of (element.getAttribute('style') ?? '').split(';')) {
        const colon = rule.indexOf(':');
        if (colon < 0) continue;
        const name = rule.slice(0, colon).trim().toLowerCase(), value = rule.slice(colon + 1).trim();
        if (PRESENTATION.test(name)) element.setAttribute(name, value);
      }
      element.removeAttribute('style');
    }
    // The DVI driver nests a fill/stroke group for every surface patch. Inherit
    // these paints onto children and unwrap only paint-only groups, keeping
    // transforms, clipping, ids and composited group opacity intact.
    svg = flattenPaint(svg);
    const bounds = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    if (!bounds || bounds.length !== 4 || bounds.some((n) => !Number.isFinite(n)) || bounds[2]! <= 0 || bounds[3]! <= 0) throw new Error('Invalid TikZ picture dimensions');
    const ratio = Number.isFinite(scale) ? Math.min(3, Math.max(0.25, scale)) : 1;
    const widthPx = Math.ceil(bounds[2]! * 96 / 72 * ratio);
    const heightPx = Math.ceil(bounds[3]! * 96 / 72 * ratio);
    if (widthPx > 16_384 || heightPx > 16_384) throw new Error('TikZ picture is too large');
    // SVG images cannot depend on external fonts. Outline every glyph locally.
    let glyphs = 0;
    const outlines = new Map<string, { data: string; first: Element; id?: string }>();
    let labelDefs: Element | undefined;
    const useOutline = (path: Element, id: string): void => {
      const use = document.createElementNS(SVG_NS, 'use');
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${id}`);
      for (const attribute of Array.from(path.attributes)) if (attribute.name !== 'd') use.setAttribute(attribute.name, attribute.value);
      path.parentNode!.replaceChild(use, path);
    };
    for (const text of Array.from(svg.getElementsByTagName('text'))) {
      glyphs += text.textContent?.length ?? 0;
      if (glyphs > 20_000) throw new Error('TikZ label size limit exceeded');
      const path = document.createElementNS(SVG_NS, 'path');
      const x = Number(text.getAttribute('x') ?? 0);
      const y = Number(text.getAttribute('y') ?? 0);
      const size = Number(text.getAttribute('font-size') ?? 10);
      if (![x, y, size].every(Number.isFinite) || size <= 0) throw new Error('Invalid TikZ label');
      const name = text.getAttribute('font-family') ?? 'cmr10';
      const key = JSON.stringify([name, text.textContent, x, y, size]);
      let outline = outlines.get(key);
      if (!outline) {
        const font = await this.font(name);
        outline = { data: font.getPath(text.textContent ?? '', x, y, size, { kerning: false }).toPathData(3), first: path };
        outlines.set(key, outline);
      }
      path.setAttribute('d', outline.data);
      for (const attribute of Array.from(text.attributes)) if (PRESENTATION.test(attribute.name)) path.setAttribute(attribute.name, attribute.value);
      path.setAttribute('fill', text.getAttribute('fill') ?? 'black');
      const transform = text.getAttribute('transform');
      if (transform) path.setAttribute('transform', transform);
      text.parentNode!.replaceChild(path, text);
      // Repeated labels often have identical local coordinates inside translated
      // groups. Share their exact path data without re-rounding/translating it.
      if (outline.first !== path && outline.data.length > 128) {
        if (!outline.id) {
          labelDefs ??= document.createElementNS(SVG_NS, 'defs');
          if (!labelDefs.parentNode) svg.insertBefore(labelDefs, svg.firstChild);
          let id = `silk-label-${outlines.size}`;
          while (document.getElementById(id)) id += '-';
          outline.id = id;
          const definition = document.createElementNS(SVG_NS, 'path');
          definition.setAttribute('id', id); definition.setAttribute('d', outline.data);
          labelDefs.appendChild(definition);
          useOutline(outline.first, id);
        }
        useOutline(path, outline.id);
      }
    }
    const pending = [svg];
    for (let element = pending.pop(); element; element = pending.pop()) {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith('on') || name === 'style'
          || ((name === 'href' || name === 'xlink:href') && !/^#[\w:.-]+$/.test(attribute.value))
          || (/url\s*\(/i.test(attribute.value) && !/^url\(#[\w:.-]+\)$/.test(attribute.value))) element.removeAttribute(attribute.name);
      }
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType !== 1) continue;
        const node = child as Element;
        if (!ALLOWED_TAGS.has(node.tagName)) element.removeChild(child);
        else pending.push(node);
      }
    }
    // A successful TeX run must not silently return an empty pattern or missing symbol.
    const elements = descendants(svg);
    const ids = new Set(elements.map((element) => element.getAttribute('id')).filter(Boolean));
    for (const element of elements) for (const attribute of Array.from(element.attributes)) {
      const reference = /^(?:href|xlink:href)$/.test(attribute.name) ? /^#(.+)$/.exec(attribute.value)?.[1]
        : /^url\(#([\w:.-]+)\)$/.exec(attribute.value)?.[1];
      if (reference && !ids.has(reference)) throw new Error(`TikZ: Missing SVG definition: ${reference}`);
    }
    const background = document.createElementNS(SVG_NS, 'rect');
    for (const [index, key] of ['x', 'y', 'width', 'height'].entries()) background.setAttribute(key, String(bounds[index]));
    background.setAttribute('fill', '#fff');
    svg.insertBefore(background, svg.firstChild);
    svg.setAttribute('width', `${widthPx}px`);
    svg.setAttribute('height', `${heightPx}px`);
    const result = new XMLSerializer().serializeToString(svg);
    if (result.length > 4 * 1024 * 1024) throw new Error('TikZ SVG is too large');
    return { svg: result, widthPx, heightPx };
  }
}
