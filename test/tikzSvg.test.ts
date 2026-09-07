import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { TikzEngine } from '../src/tikz/engine';

// Exercise SVG finishing directly; no TeX runtime download or UI is needed.
const engine = new TikzEngine(resolve('.')) as unknown as {
  finishSvg(html: string, scale: number): Promise<{ svg: string }>;
};
const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 50">${body}</svg>`;

describe('TikZ standalone SVG fidelity', () => {
  it('flattens deep surface paint groups without removing transform, clip or composited opacity', async () => {
    const body = '<defs><clipPath id="area"><rect width="10" height="10"/></clipPath></defs>'
      + '<g transform="translate(2 3)" opacity=".5" clip-path="url(#area)">'
      + '<g fill="red" stroke="blue">'.repeat(1200)
      + '<path d="M0 0L1 1"/><path d="M2 2L3 3" fill="green"/>'
      + '</g>'.repeat(1200) + '</g>';
    const result = await engine.finishSvg(svg(body), 1);
    expect(result.svg.match(/<g\b/g)).toHaveLength(1);
    expect(result.svg).toContain('transform="translate(2 3)" opacity=".5" clip-path="url(#area)"');
    expect(result.svg).toContain('d="M0 0L1 1" fill="red" stroke="blue"');
    expect(result.svg).toContain('d="M2 2L3 3" fill="green" stroke="blue"');
  });

  it('shares exact repeated label outlines while retaining each label paint and transform', async () => {
    const renderer = new TikzEngine(resolve('.'));
    const internals = renderer as unknown as { font: () => Promise<unknown>; finishSvg: typeof engine.finishSvg };
    const data = 'M0 0' + 'L1.234 5.678'.repeat(20) + 'Z';
    const getPath = vi.fn(() => ({ toPathData: () => data }));
    vi.spyOn(internals, 'font').mockResolvedValue({ getPath });
    const output = await internals.finishSvg(svg('<path id="silk-label-1" d="M0 0"/>'
      + '<text x="1.2" y="3.4" fill="red" opacity=".5" transform="rotate(10)">A</text>'
      + '<g transform="translate(10 20)"><text x="1.2" y="3.4" fill="blue" stroke="green">A</text></g>'), 1);
    expect(getPath).toHaveBeenCalledTimes(1);
    expect(getPath).toHaveBeenCalledWith('A', 1.2, 3.4, 10, { kerning: false });
    expect(output.svg.split(data)).toHaveLength(2);
    expect(output.svg).toContain('xlink:href="#silk-label-1-" fill="red" opacity=".5" transform="rotate(10)"');
    expect(output.svg).toContain('fill="blue" stroke="green"');
    expect(output.svg).toContain('transform="translate(10 20)"');
    expect(output.svg).not.toContain('<text');
  });

  it('preserves gradient paint, symbols and local references while discarding active markup', async () => {
    const result = await engine.finishSvg(svg('<defs><linearGradient id="gradient"><stop offset="0" stop-color="blue"/></linearGradient><symbol id="stripe"><path d="M0 0L3 3"/></symbol></defs>'
      + '<rect width="100" height="50" style="fill:url(#gradient); stroke:none; opacity:.5" onclick="alert(1)"/><use xlink:href="#stripe"/><script>bad()</script>'), 1);
    expect(result.svg).toContain('fill="url(#gradient)"');
    expect(result.svg).toContain('stroke="none"');
    expect(result.svg).toContain('opacity=".5"');
    expect(result.svg).toContain('<symbol id="stripe"');
    expect(result.svg).not.toMatch(/style=|onclick|script/);
  });

  it('rejects incomplete pictures with unresolved SVG references', async () => {
    await expect(engine.finishSvg(svg('<path d="M0 0L1 1" fill="url(#missing)"/>'), 1)).rejects.toThrow('Missing SVG definition: missing');
    await expect(engine.finishSvg(svg('<use xlink:href="#missing"/>'), 1)).rejects.toThrow('Missing SVG definition: missing');
  });

  it('does not restore external links when converting presentation styles', async () => {
    const result = await engine.finishSvg(svg('<rect width="10" height="10" style="fill:url(https://example.invalid/a); background:url(file:///private)"/>'), 1);
    expect(result.svg).not.toMatch(/https:|file:|style=|background=/);
  });
});
