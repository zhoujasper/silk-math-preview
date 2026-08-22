/** 测试通道：扩展 ID / 命令 / 配置都和正式版分开，可同时安装。 */
export const IS_TEST_CHANNEL = true;
export const COMMAND_NS = 'silkMathTest';
export const PRODUCT_NAME = 'Silk Math Test';

export function cmd(name: string): string {
  return `${COMMAND_NS}.${name}`;
}
