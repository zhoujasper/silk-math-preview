import { describe, expect, it } from 'vitest';

import { cmd, COMMAND_NS, IS_TEST_CHANNEL, PRODUCT_NAME } from '../src/core/channel';
// 打包脚本是纯 ESM，没有进 tsconfig 的 include。
// @ts-expect-error packaging helper is untyped ESM
import { transformManifest, vsixFileName } from '../scripts/channelManifest.mjs';

describe('扩展通道', () => {
  it('源码默认是正式通道，命令仍是 silkMath.*', () => {
    expect(IS_TEST_CHANNEL).toBe(false);
    expect(COMMAND_NS).toBe('silkMath');
    expect(PRODUCT_NAME).toBe('Silk Math');
    expect(cmd('showMenu')).toBe('silkMath.showMenu');
  });

  it('测试清单换成独立扩展 ID 和命令前缀', () => {
    const official = {
      name: 'silk-math-preview',
      displayName: 'Silk Math Preview',
      description: 'Live math preview',
      version: '0.1.72',
      private: false,
      activationEvents: ['onCommand:silkMath.showMenu'],
      contributes: {
        commands: [{ command: 'silkMath.showMenu', title: 'Silk Math: 打开状态栏菜单 / Open Status Menu' }],
        keybindings: [
          { command: 'silkMath.togglePreview', key: 'ctrl+alt+m', mac: 'cmd+alt+m' },
          { command: 'silkMath.dismissFlyout', key: 'escape', when: 'silkMath.flyoutVisible' },
        ],
        configuration: {
          title: 'Silk Math Preview',
          properties: { 'silkMath.enabled': { type: 'boolean', default: true } },
        },
      },
    };
    const test = transformManifest(official, 'test');
    expect(test.name).toBe('silk-math-preview-test');
    expect(test.displayName).toBe('Silk Math Preview (Test)');
    expect(test.private).toBe(true);
    expect(test.contributes.commands[0].command).toBe('silkMathTest.showMenu');
    expect(test.contributes.commands[0].title).toContain('Silk Math Test:');
    expect(test.contributes.keybindings[0]).toMatchObject({
      command: 'silkMathTest.togglePreview',
      key: 'ctrl+alt+shift+m',
      mac: 'cmd+alt+shift+m',
    });
    expect(test.contributes.keybindings[1].when).toBe('silkMathTest.flyoutVisible');
    expect(test.contributes.configuration.properties['silkMathTest.enabled']).toBeDefined();
    expect(test.contributes.configuration.properties['silkMath.enabled']).toBeUndefined();
    expect(vsixFileName(official, 'release')).toBe('silk-math-preview-0.1.72.vsix');
    expect(vsixFileName(official, 'test')).toBe('silk-math-preview-test-0.1.72.vsix');
    expect(transformManifest(official, 'release').name).toBe('silk-math-preview');
  });
});
