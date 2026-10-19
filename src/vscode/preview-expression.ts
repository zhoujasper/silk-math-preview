// 预览表达式构造（光标锚定、表格翻译、未完成输入恢复）只在第一次真正预览公式时加载，
// 不进入扩展激活路径。
export { buildPreviewExpression } from '../core/previewExpression';
export { recoverIncompleteTex } from '../core/incompleteTex';
export { resolveTableEmbeds } from '../core/tablePreview';
export { definitionPreviewSample, isDefinitionOnlySource, withDefinitionPreviewSample } from '../core/definitionPreview';
