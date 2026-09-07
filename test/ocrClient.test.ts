import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OcrClient } from '../src/ocr/ocrClient';

let directory: string;
let workerPath: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'silk-ocr-client-test-'));
  workerPath = join(directory, 'worker.cjs');
  await writeFile(workerPath, `
    const {parentPort,threadId}=require('node:worker_threads');
    parentPort.on('message', ({id,image,mode}) => {
      if(image[0]===2) { parentPort.postMessage({id,type:'error',message:'broken runtime'}); return; }
      if(image[0]===3) return;
      if(image[0]===4) throw new Error('worker crash');
      parentPort.postMessage({id,type:'progress',stage:'models',ratio:0.5});
      setTimeout(()=>parentPort.postMessage({id,type:'result',result:{text:String(threadId),ok:true,mode}}),10);
    });
  `);
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });
const run = (client: OcrClient, value = 0, abort = new AbortController()) => client.recognize(Uint8Array.of(value), 'formula', abort.signal, () => undefined);

describe('OCR Worker 生命周期', () => {
  it('连点不会创建竞争任务，成功后复用模型', async () => {
    const client = new OcrClient(workerPath, directory);
    try {
      const first = run(client);
      await expect(run(client)).rejects.toThrow('OCR busy');
      const result = await first;
      expect((await run(client)).text).toBe(result.text);
    } finally { client.dispose(); }
  });
  it('取消当前识别会立即结束等待，下次能重新识别', async () => {
    const client = new OcrClient(workerPath, directory);
    try {
      const first = await run(client);
      const abort = new AbortController();
      const pending = run(client, 3, abort); abort.abort();
      await expect(pending).rejects.toThrow('cancelled');
      expect((await run(client)).text).not.toBe(first.text);
    } finally { client.dispose(); }
  });
  it.each([2, 4])('运行失败或崩溃 (%i) 后不复用被污染的上下文', async (value) => {
    const client = new OcrClient(workerPath, directory);
    try {
      const first = await run(client);
      await expect(run(client, value)).rejects.toThrow(/broken runtime|worker crash/);
      expect((await run(client)).text).not.toBe(first.text);
    } finally { client.dispose(); }
  });
  it('空闲释放后可重新启动，dispose 也会终止未完成请求', async () => {
    const client = new OcrClient(workerPath, directory, 25);
    try {
      const first = await run(client);
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect((await run(client)).text).not.toBe(first.text);
      const pending = run(client, 3); client.dispose();
      await expect(pending).rejects.toThrow('cancelled');
    } finally { client.dispose(); }
  });
});
