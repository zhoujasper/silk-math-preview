/** 正式 Marketplace 通道。测试包构建时由 esbuild 换成 channelTest.ts。 */
export const IS_TEST_CHANNEL = false;
export const COMMAND_NS = 'silkMath';
export const PRODUCT_NAME = 'Silk Math';

export function cmd(name: string): string {
  return `${COMMAND_NS}.${name}`;
}
