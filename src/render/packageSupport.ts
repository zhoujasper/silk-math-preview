import '@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js';
import '@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js';
import '@mathjax/src/js/input/tex/braket/BraketConfiguration.js';
import '@mathjax/src/js/input/tex/upgreek/UpgreekConfiguration.js';
import '@mathjax/src/js/input/tex/amscd/AmsCdConfiguration.js';
import '@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js';
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js';
import '@mathjax/src/js/input/tex/textcomp/TextcompConfiguration.js';
import './siunitx';
import { MathtoolsUtil } from '@mathjax/src/js/input/tex/mathtools/MathtoolsUtil.js';
import { MathtoolsMethods } from '@mathjax/src/js/input/tex/mathtools/MathtoolsMethods.js';
import { NewcommandUtil } from '@mathjax/src/js/input/tex/newcommand/NewcommandUtil.js';

// 预览会按命令自动加载 braket/physics 等宏包，而用户文档并未加载它们。MathJax 的
// \DeclarePairedDelimiter 遇到同名宏包命令会报“已定义”并被丢弃，结果 \braket{a}{b}
// 退化成宏包的单参数版本。用户声明属于文档本身，应覆盖自动加载的同名命令。
MathtoolsUtil.addPairedDelims = (parser, cs, args) => {
  NewcommandUtil.addMacro(parser, cs, MathtoolsMethods.PairedDelimiters!, args);
};

/** 仅使用随 Worker 发布的实现。声明和实际命令同时参与选择，不联网拉取宏包。 */
export function renderPackages(declared: readonly string[], expression: string, prelude: string): string[] {
  const source = `${expression}\n${prelude}`;
  const packages = ['textmacros', 'silk-si'];
  const available: ReadonlyArray<readonly [string, RegExp]> = [
    ['mathtools', /\\(?:coloneqq|eqqcolon|coloneq|eqcolon|mathclap|mathllap|mathrlap|prescript|smashoperator|DeclarePairedDelimiter(?:X|XPP)?|begin\{(?:dcases|rcases|multlined|smallmatrix))\b/],
    ['braket', /\\(?:bra|ket|braket|set|ketbra|Bra|Ket|Braket|Set|Ketbra)\b/],
    ['upgreek', /\\up(?:alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|rho|sigma|phi|omega)\b/],
    ['amscd', /\\begin\{CD\}/],
    ['mhchem', /\\(?:ce|pu)\b/],
    ['textcomp', /\\text(?:degree|celsius|ohm|mu|euro|copyright|registered|trademark)\b/],
  ];
  for (const [name, pattern] of available) {
    if (declared.includes(name) || pattern.test(source)) packages.push(name);
  }
  // physics 的 \qty 是自动定界符，与 siunitx 同名；声明 physics 时遵从其语义。
  if (declared.includes('physics')) packages.push('physics');
  else packages.push('silk-qty');
  return packages;
}
