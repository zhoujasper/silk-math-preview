import type { MmlNode } from '@mathjax/src/js/core/MmlTree/MmlNode.js';
import type { SVG } from '@mathjax/src/js/output/svg.js';

export const SI_CELLS_KEY = 'silk-si-cells';
export interface SiCell { left: MmlNode; right: MmlNode }

/** Measure the two sides once, before table layout. No SVG rewrite or second render. */
export function alignSiColumns<N, T, D>(output: SVG<N, T, D>, cells: readonly SiCell[]): void {
  const tables = new Map<MmlNode, Map<number, Array<SiCell & { leftWidth: number; rightWidth: number }>>>();
  output.nodeMap = new Map();
  try {
    for (const cell of cells) {
      let mtd: MmlNode | null = cell.left.parent;
      while (mtd && mtd.kind !== 'mtd') mtd = mtd.parent;
      const row = mtd?.parent;
      const table = row?.parent;
      if (!mtd || !row || table?.kind !== 'mtable') continue;
      const column = row.childNodes.indexOf(mtd);
      const columns = tables.get(table) ?? new Map();
      tables.set(table, columns);
      const values = columns.get(column) ?? [];
      columns.set(column, values);
      const width = (pad: MmlNode): number => output.factory.wrap(pad).getOuterBBox().w;
      values.push({ ...cell, leftWidth: width(cell.left), rightWidth: width(cell.right) });
    }
    for (const columns of tables.values()) for (const values of columns.values()) {
      let left = 0;
      let right = 0;
      for (const value of values) { left = Math.max(left, value.leftWidth); right = Math.max(right, value.rightWidth); }
      for (const value of values) {
        value.left.attributes.set('width', `${left}em`);
        value.left.attributes.set('lspace', `${Math.max(0, left - value.leftWidth)}em`);
        value.right.attributes.set('width', `${right}em`);
      }
    }
  } finally {
    output.nodeMap.clear();
  }
}
