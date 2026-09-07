import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ install: vi.fn(), render: vi.fn(), dispose: vi.fn(), create: vi.fn() }));
vi.mock('../src/tikz/pack', () => ({ TIKZ_PACK_VERSION: 'test-pack', ensureTikzPack: mocks.install }));
vi.mock('../src/render/renderClient', () => ({ RenderClient: class {
  constructor(...args: unknown[]) { mocks.create(...args); }
  render = mocks.render;
  dispose = mocks.dispose;
  setIdleMs() {}
} }));
vi.mock('vscode', () => ({
  ProgressLocation: { Notification: 1 },
  window: { withProgress: (_options: unknown, work: (progress: unknown, token: unknown) => unknown) => work(
    { report() {} }, { onCancellationRequested: () => ({ dispose() {} }) },
  ) },
}));

import { TikzService } from '../src/vscode/tikzService';

const context = { globalStorageUri: { fsPath: '/unused-test-storage' }, asAbsolutePath: (path: string) => `/extension/${path}` };
const input = { expression: 'picture', definitionPrelude: '', definitionFingerprint: '', displayMode: true, scale: 1, exPx: 0, foreground: '#000', caretColor: '', markUnknownCommands: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.install.mockResolvedValue('/installed-runtime');
  mocks.render.mockResolvedValue({ ok: true, svg: '<svg/>', widthPx: 10, heightPx: 10 });
  mocks.dispose.mockResolvedValue(undefined);
});

describe('TikZ service remains optional', () => {
  it('does not install or launch anything on construction, scaling or cancellation', () => {
    const service = new TikzService(context as never);
    service.setIdleMs(20_000);
    service.cancel();
    service.dispose();
    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('prepares once and reuses a render when only the source caret moved', async () => {
    const service = new TikzService(context as never);
    try {
      const first = service.render(input);
      expect(service.render({ ...input, caretColor: '#ff0' })).toBe(first);
      expect(await first).toMatchObject({ ok: true });
      expect(mocks.install).toHaveBeenCalledTimes(1);
      expect(mocks.create).toHaveBeenCalledWith('/extension/dist/tikz-worker.js', 60_000, expect.objectContaining({ workerData: { packRoot: '/installed-runtime' } }));
      expect(mocks.render).toHaveBeenCalledTimes(1);
      await service.render({ ...input, expression: 'edited' });
      expect(mocks.install).toHaveBeenCalledTimes(1);
      expect(mocks.render).toHaveBeenCalledTimes(2);
    } finally { service.dispose(); }
  });

  it('turning off during installation prevents a late worker start; enabling again works', async () => {
    let finish!: (root: string) => void;
    mocks.install.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve; }));
    const service = new TikzService(context as never);
    try {
      const pending = service.render(input);
      service.cancel();
      finish('/late-runtime');
      expect(await pending).toMatchObject({ ok: false, error: 'cancelled' });
      expect(mocks.create).not.toHaveBeenCalled();
      expect(await service.render(input)).toMatchObject({ ok: true });
      expect(mocks.create).toHaveBeenCalledTimes(1);
    } finally { service.dispose(); }
  });

  it('allows retry after a failed component download', async () => {
    mocks.install.mockRejectedValueOnce(new Error('offline'));
    const service = new TikzService(context as never);
    try {
      expect(await service.render(input)).toMatchObject({ ok: false, error: 'TikZ: offline' });
      expect(mocks.create).not.toHaveBeenCalled();
      expect(await service.render(input)).toMatchObject({ ok: true });
    } finally { service.dispose(); }
  });

  it('reuses the validated component location after dismissal and keeps the engine on a syntax error', async () => {
    const service = new TikzService(context as never);
    try {
      await service.render(input);
      service.cancel();
      await service.render(input);
      expect(mocks.install).toHaveBeenCalledTimes(1);
      expect(mocks.create).toHaveBeenCalledTimes(2);
      expect(mocks.create.mock.calls[1]![2]).not.toHaveProperty('restartOnFailure', true);
      mocks.render.mockResolvedValueOnce({ ok: false, error: 'syntax' });
      await service.render({ ...input, expression: 'incomplete' });
      expect(await service.render(input)).toMatchObject({ ok: true });
      expect(mocks.create).toHaveBeenCalledTimes(2);
    } finally { service.dispose(); }
  });
});
