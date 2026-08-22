/** 把 package.json 改成测试通道清单：不同扩展 ID、命令和配置，避免盖掉正式版。 */

export function transformManifest(pkg, channel) {
  if (channel !== 'test') return structuredClone(pkg);
  const next = JSON.parse(JSON.stringify(pkg).replaceAll('silkMath.', 'silkMathTest.'));
  next.name = 'silk-math-preview-test';
  next.displayName = 'Silk Math Preview (Test)';
  next.private = true;
  next.description = `[TEST] ${pkg.description} 仅供本机安装，不要发到 Marketplace。`;
  if (next.contributes?.configuration) {
    next.contributes.configuration.title = 'Silk Math Preview (Test)';
  }
  for (const command of next.contributes?.commands ?? []) {
    if (typeof command.title === 'string') {
      command.title = command.title.replace('Silk Math:', 'Silk Math Test:');
    }
  }
  for (const binding of next.contributes?.keybindings ?? []) {
    if (binding.command === 'silkMathTest.togglePreview') {
      binding.key = 'ctrl+alt+shift+m';
      binding.mac = 'cmd+alt+shift+m';
    }
  }
  return next;
}

export function vsixFileName(pkg, channel) {
  const version = pkg.version;
  return channel === 'test'
    ? `silk-math-preview-test-${version}.vsix`
    : `silk-math-preview-${version}.vsix`;
}
