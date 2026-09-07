// SPDX-License-Identifier: GPL-3.0-or-later
// Synchronous, memory-only I/O for the pinned TikZJax TeX ABI.
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';

const PAGE = 65_536;
const PAGES = 1100;
const STACK = (PAGES - 100) * PAGE;
const EMPTY = Buffer.alloc(PAGE);
const LIMIT = 4 * 1024 * 1024;
const CONTEXT = 'silk-context.tex';
const FRAME = 'silk-frame.tex';
type Exports = WebAssembly.Exports & Record<'main' | 'asyncify_stop_unwind' | 'asyncify_stop_rewind', () => void>
  & Record<'asyncify_start_unwind' | 'asyncify_start_rewind', (address: number) => void>;
interface File { name: string; data: Uint8Array; pos: number; line: number; eof: boolean; eol: boolean; error: number; writable: boolean; stdin: boolean }
interface Snapshot { pages: Map<number, Buffer>; globals: number[]; files: File[] }

/** Only the four pinned i32 globals gain exports; instructions and imports stay intact. */
export function checkpointModule(bytes: Uint8Array): Uint8Array {
  let position = 8;
  const read = (): number => { let n = 0, shift = 0, b: number; do { b = bytes[position++]!; n |= (b & 127) << shift; shift += 7; } while (b & 128); return n; };
  const encode = (n: number): number[] => { const out: number[] = []; do { const b = n & 127; n >>>= 7; out.push(b | (n ? 128 : 0)); } while (n); return out; };
  const chunks: Uint8Array[] = [bytes.subarray(0, 8)];
  let globals = false, exports = false;
  while (position < bytes.length) {
    const start = position, id = bytes[position++]!, length = read(), end = position + length;
    if (id === 6) {
      // Fail closed if a future pack changes the ABI or adds reference/i64 globals.
      const expected = '047f0141ffffaf220b7f01417f0b7f0141000b7f0141000b';
      if (Buffer.from(bytes.subarray(position, end)).toString('hex') !== expected) throw new Error('Unsupported TeX checkpoint ABI');
      globals = true;
    }
    if (id === 7) {
      const count = read();
      const extra: number[] = [];
      for (let i = 0; i < 4; i++) { const name = Buffer.from(`silkGlobal${i}`); extra.push(...encode(name.length), ...name, 3, i); }
      const payload = Buffer.concat([Buffer.from(encode(count + 4)), bytes.subarray(position, end), Buffer.from(extra)]);
      chunks.push(Buffer.from([7, ...encode(payload.length)]), payload);
      exports = true;
    } else chunks.push(bytes.subarray(start, end));
    position = end;
  }
  if (!globals || !exports) throw new Error('Invalid TeX checkpoint module');
  return Buffer.concat(chunks);
}

export class TexRuntime {
  private readonly memory = new WebAssembly.Memory({ initial: PAGES, maximum: PAGES });
  private readonly bytes = new Uint8Array(this.memory.buffer);
  private readonly words = new Uint32Array(this.memory.buffer);
  private exports!: Exports;
  private base!: Snapshot;
  private header: { key: string; snapshot: Snapshot } | undefined;
  private cached: { key: string; snapshot: Snapshot } | undefined;
  private files: File[] = [];
  private context = new Uint8Array();
  private frame = new Uint8Array();
  private suspended = false;
  private rewinding = false;
  private finished = false;
  private checkpointing: string | undefined;
  private outputBytes = 0;
  private date = new Date();
  private readonly metrics = new Map<string, Uint8Array>();

  constructor(private readonly packages: Map<string, Buffer>, private readonly tfm: (name: string) => Uint8Array) {}

  async initialize(module: WebAssembly.Module, corePath: string): Promise<void> {
    // Inflate directly into the one reusable memory: no extra 69 MiB core buffer.
    let offset = 0;
    for await (const chunk of createReadStream(corePath).pipe(createGunzip())) {
      if (offset + chunk.length > this.bytes.length) throw new Error('Invalid TeX core size');
      this.bytes.set(chunk, offset); offset += chunk.length;
    }
    if (offset !== this.bytes.length) throw new Error('Invalid TeX core size');
    const instance = await WebAssembly.instantiate(module, { env: { memory: this.memory }, library: this.imports() });
    this.exports = instance.exports as Exports;
    this.base = this.snapshot();
  }

  render(preamble: string, expression: string, context: string): Buffer {
    this.date = new Date();
    try {
      // Package loading is independent of user definitions. Editing a \def only
      // replays the small context, while a package/option edit invalidates both.
      if (this.header?.key !== preamble) {
        this.header = this.cached = undefined;
        this.restore(this.base);
        this.checkpointing = CONTEXT;
        this.open('input.tex', Buffer.from(`${preamble}\n\\begin{document}\n\\input{${CONTEXT}}%\n\\end{document}\n`));
        this.header = { key: preamble, snapshot: this.checkpoint(this.base) };
      }
      if (this.cached?.key !== context) {
        this.cached = undefined;
        this.restore(this.header.snapshot);
        this.context = Buffer.from(`${context}\n\\input{${FRAME}}%\n`);
        this.checkpointing = FRAME;
        this.rewind();
        this.cached = { key: context, snapshot: this.checkpoint(this.header.snapshot) };
      }
      this.restore(this.cached.snapshot);
      this.checkpointing = undefined;
      this.frame = Buffer.from(expression);
      this.rewind();
      this.exports.main();
      this.checkLog();
      if (!this.finished) throw new Error('TikZ compilation did not finish');
      const dvi = this.files.find((file) => file.name === 'input.dvi' && file.writable);
      if (!dvi) throw new Error('TikZ produced no picture');
      return Buffer.from(dvi.data.subarray(0, dvi.pos));
    } finally {
      // Drop transient outputs immediately; immutable packages/checkpoint remain bounded.
      this.files = []; this.context = this.frame = new Uint8Array();
    }
  }

  private rewind(): void {
    this.rewinding = true;
    this.exports.asyncify_start_rewind(STACK);
  }

  private checkpoint(parent: Snapshot): Snapshot {
    this.exports.main();
    if (!this.suspended) { this.checkLog(); throw new Error('TikZ did not reach the picture'); }
    this.exports.asyncify_stop_unwind();
    this.checkLog();
    return this.snapshot(parent);
  }

  private snapshot(parent?: Snapshot): Snapshot {
    const pages = new Map<number, Buffer>();
    const view = Buffer.from(this.memory.buffer);
    for (let offset = 0; offset < view.length; offset += PAGE) {
      const page = view.subarray(offset, offset + PAGE);
      const previous = parent?.pages.get(offset);
      // Immutable equal pages are shared; the second checkpoint does not copy
      // another complete TeX heap. Only pages changed by definitions cost memory.
      if (previous && page.equals(previous)) pages.set(offset, previous);
      else if (!page.equals(EMPTY)) pages.set(offset, Buffer.from(page));
    }
    return { pages, globals: [0, 1, 2, 3].map((i) => Number((this.exports[`silkGlobal${i}`] as WebAssembly.Global).value)), files: this.cloneFiles() };
  }

  private cloneFiles(): File[] {
    return this.files.map((file) => ({ ...file, data: file.writable ? file.data.slice() : file.data }));
  }

  private restore(snapshot: Snapshot): void {
    this.bytes.fill(0);
    for (const [offset, page] of snapshot.pages) this.bytes.set(page, offset);
    snapshot.globals.forEach((value, i) => { (this.exports[`silkGlobal${i}`] as WebAssembly.Global).value = value; });
    this.files = snapshot.files;
    this.files = this.cloneFiles();
    this.outputBytes = this.files.reduce((sum, file) => sum + (file.writable ? file.data.length : 0), 0);
    this.finished = this.suspended = this.rewinding = false;
  }

  private checkLog(): void {
    const log = this.files.find((file) => file.name === 'input.log' && file.writable);
    const text = log ? Buffer.from(log.data.subarray(0, log.pos)).toString('utf8') : '';
    const failure = /^!\s*(.+(?:\r?\n(?!\s*$|l\.\d|!)[^\r\n]+){0,3})/m.exec(text)?.[1];
    if (failure) throw new Error(`TikZ: ${failure.replace(/\s+/g, ' ').trim().slice(0, 600)}`);
    const unsupported = /^Package pgf Warning: Your graphic driver [\s\S]{0,150}?does not support ([\s\S]{0,120}?)\.\s*This warning/m.exec(text)?.[1];
    if (unsupported) throw new Error(`TikZ: SVG driver does not support ${unsupported.replace(/\r?\n/g, '').replace(/\s+/g, ' ').trim()}`);
    const missing = /^Missing character: (.+)$/m.exec(text)?.[1];
    if (missing) throw new Error(`TikZ: ${missing}`);
  }

  private open(name: string, data: Uint8Array, writable = false, error = 0): number {
    if (this.files.length >= 4096) throw new Error('TikZ file limit exceeded');
    return this.files.push({ name, data, pos: 0, line: 0, eof: false, eol: false, error, writable, stdin: name === 'TTY:' }) - 1;
  }

  private name(length: number, pointer: number): string {
    return Buffer.from(this.memory.buffer, pointer, length).toString('latin1').replace(/\0+$/, '')
      .replace(/^[{"*]/, '').replace(/[}"].*$/, '').trimEnd().replace(/^TeXfonts:/, '').replace(/^TeXformats:TEX.POOL$/, 'tex.pool');
  }

  private write(fd: number, bytes: Uint8Array): void {
    if (fd < 0 || this.files[fd]?.name === 'TTY:') return;
    const file = this.files[fd]!, end = file.pos + bytes.length;
    if (!file.writable || end > LIMIT) throw new Error('TikZ output is too large');
    if (end > file.data.length) {
      const capacity = Math.max(end, Math.min(LIMIT, Math.max(1024, file.data.length * 2)));
      this.outputBytes += capacity - file.data.length;
      if (this.outputBytes > 2 * LIMIT) throw new Error('TikZ output memory limit exceeded');
      const grown = new Uint8Array(capacity); grown.set(file.data); file.data = grown;
    }
    file.data.set(bytes, file.pos); file.pos = end;
  }

  private imports(): Record<string, (...args: number[]) => number | void> {
    const noop = (): void => {};
    return {
      printInteger: (fd, n) => this.write(fd!, Buffer.from(String(n))),
      printChar: (fd, n) => this.write(fd!, Uint8Array.of(n!)),
      printString: (fd, p) => this.write(fd!, this.bytes.subarray(p! + 1, p! + 1 + this.bytes[p!]!)),
      printNewline: (fd) => this.write(fd!, Uint8Array.of(10)), close: noop,
      getCurrentMinutes: () => 60 * this.date.getHours() + this.date.getMinutes(),
      getCurrentDay: () => this.date.getDate(), getCurrentMonth: () => this.date.getMonth() + 1, getCurrentYear: () => this.date.getFullYear(),
      tex_final_end: () => { this.finished = true; },
      reset: (length, pointer) => {
        const name = this.name(length!, pointer!);
        if (name === FRAME || name === CONTEXT) {
          if (this.rewinding) { this.exports.asyncify_stop_rewind(); this.rewinding = false; }
          else if (name === this.checkpointing) {
            this.words[STACK >> 2] = STACK + 8; this.words[(STACK + 4) >> 2] = this.bytes.length;
            this.suspended = true; this.exports.asyncify_start_unwind(STACK); return -1;
          }
          return this.open(name, name === FRAME ? this.frame : this.context);
        }
        if (name === 'TTY:') return this.open(name, Buffer.from(' input.tex \n\\end\n'));
        const written = this.files.find((file) => file.name === name && (file.writable || name === 'input.tex'));
        if (written) return this.open(name, written.writable ? written.data.subarray(0, written.pos) : written.data);
        let data: Uint8Array | undefined = this.packages.get(name);
        if (!data && /\.tfm$/.test(name)) {
          data = this.metrics.get(name);
          if (!data) { data = Uint8Array.from(this.tfm(name.slice(0, -4))); this.metrics.set(name, data); }
        }
        return this.open(name, data ?? new Uint8Array(), false, data ? 0 : 1);
      },
      rewrite: (length, pointer) => this.open(this.name(length!, pointer!), new Uint8Array(), true),
      eof: (fd) => Number(this.files[fd!]!.eof), eoln: (fd) => Number(this.files[fd!]!.eol), erstat: (fd) => this.files[fd!]!.error,
      inputln: (fd, bypass, buffer, first, last, _max, size) => {
        const file = this.files[fd!]!;
        if (bypass && !file.eof && file.eol) file.line++;
        this.words[last! >> 2] = this.words[first! >> 2]!;
        if (file.line >= file.data.length) { file.eof = true; if (file.stdin) this.finished = true; return 0; }
        let end = file.data.indexOf(10, file.line); if (end < 0) end = file.data.length;
        const start = this.words[first! >> 2]!;
        if (start + end - file.line > size!) throw new Error('TikZ input line is too long');
        this.bytes.set(file.data.subarray(file.line, end), buffer! + start);
        let count = start + end - file.line;
        while (count > start && this.bytes[buffer! + count - 1] === 32) count--;
        this.words[last! >> 2] = count; file.line = end; file.eol = true; return 1;
      },
      get: (fd, pointer, length) => {
        const file = this.files[fd!]!, count = Math.min(length!, file.data.length - file.pos);
        if (count <= 0) { this.bytes[pointer!] = file.stdin ? 13 : 0; file.eof = file.eol = true; if (file.stdin) this.finished = true; return; }
        this.bytes.set(file.data.subarray(file.pos, file.pos + count), pointer!); file.pos += count;
        file.eol = this.bytes[pointer!] === 10 || this.bytes[pointer!] === 13;
      },
      put: (fd, pointer, length) => this.write(fd!, this.bytes.subarray(pointer!, pointer! + length!)),
    };
  }
}
