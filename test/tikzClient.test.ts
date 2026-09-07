import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RenderClient } from '../src/render/renderClient';

let root: string;
let worker: string;
const input = (expression: string) => ({ expression, displayMode: true, definitionFingerprint: '', definitionPrelude: '', foreground: '#000', caretColor: '', scale: 1, exPx: 0, markUnknownCommands: false });

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'silk-tikz-client-'));
  worker = join(root, 'worker.cjs');
  await writeFile(worker, `const {parentPort,workerData}=require('node:worker_threads');
    parentPort.on('message',r=>{if(r.expression==='hang')return;setTimeout(()=>parentPort.postMessage({type:'result',id:r.id,ok:r.expression!=='error',svg:r.expression+workerData.label,widthPx:100,heightPx:50,renderMs:40,error:'invalid source'}),40)});`);
});
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

describe('optional TikZ render worker lifecycle', () => {
  it('starts lazily, keeps only the latest queued edit, and carries the runtime path', async () => {
    const client = new RenderClient(worker, 60_000, { workerData: { label: '-runtime' } });
    try {
      expect(client.stats().workerStarts).toBe(0);
      const first = client.render(input('first'));
      const skipped = client.render(input('skipped'));
      const newest = client.render(input('newest'));
      expect(await skipped).toMatchObject({ ok: false, error: 'superseded' });
      expect(await first).toMatchObject({ ok: true, svg: 'first-runtime' });
      expect(await newest).toMatchObject({ ok: true, svg: 'newest-runtime' });
      expect(client.stats().workerStarts).toBe(1);
    } finally { await client.dispose(); }
  });

  it('restarts after a failed TeX context and releases an idle worker', async () => {
    const client = new RenderClient(worker, 20, { workerData: { label: '' }, restartOnFailure: true });
    try {
      expect(await client.render(input('error'))).toMatchObject({ ok: false });
      expect(await client.render(input('fixed'))).toMatchObject({ ok: true });
      expect(client.stats().workerStarts).toBe(2);
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(await client.render(input('after-idle'))).toMatchObject({ ok: true });
      expect(client.stats().workerStarts).toBe(3);
    } finally { await client.dispose(); }
  });

  it('terminates stuck TeX and rejects queued work when switched off', async () => {
    const client = new RenderClient(worker, 60_000, { timeoutMs: 80, workerData: { label: '' } });
    await expect(client.render(input('hang'))).rejects.toThrow('timed out');
    const pending = expect(client.render(input('hang'))).rejects.toThrow('关闭');
    const queued = expect(client.render(input('queued'))).rejects.toThrow('关闭');
    await client.dispose();
    await Promise.all([pending, queued]);
  });
});
