import '@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js';
import '@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js';
import '@mathjax/src/js/input/tex/braket/BraketConfiguration.js';
import '@mathjax/src/js/input/tex/upgreek/UpgreekConfiguration.js';
import '@mathjax/src/js/input/tex/amscd/AmsCdConfiguration.js';
import '@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js';
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js';
import '@mathjax/src/js/input/tex/textcomp/TextcompConfiguration.js';
import './siunitx';

/** 仅使用随 Worker 发布的实现。声明和实际命令同时参与选择，不联网拉取宏包。 */
export function renderPackages(declared: readonly string[], expression: string, prelude: string): string[] {
  const source = `${expression}\n${prelude}`;
  const packages = ['textmacros', 'silk-si'];
  const available: ReadonlyArray<readonly [string, RegExp]> = [
    ['mathtools', /\\(?:coloneqq|eqqcolon|coloneq|eqcolon|mathclap|mathllap|mathrlap|prescript|smashoperator|DeclarePairedDelimiter(?:X|XPP)?|begin\{(?:dcases|rcases|multlined|smallmatrix))\b/],
    ['braket', /\\(?:bra|ket|braket|Bra|Ket|Braket|Set)\b/],
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
