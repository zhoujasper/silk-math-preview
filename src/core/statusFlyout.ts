/** 预览缩放：与 package.json 的取值范围保持一致。 */
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3;
/** 实际渲染倍率 1.35（相对编辑器字号 135%），界面把这个大小显示成 100%。 */
export const DEFAULT_SCALE = 1.35;
export const SCALE_STEP = DEFAULT_SCALE * 0.05;

export function scaleToDisplayPercent(scale: number): number {
  return Math.round((scale / DEFAULT_SCALE) * 100);
}
