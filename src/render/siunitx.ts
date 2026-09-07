import { Configuration } from '@mathjax/src/js/input/tex/Configuration.js';
import { CommandMap } from '@mathjax/src/js/input/tex/TokenMap.js';
import TexParser from '@mathjax/src/js/input/tex/TexParser.js';
import { TextParser } from '@mathjax/src/js/input/tex/textmacros/TextParser.js';
import BaseMethods from '@mathjax/src/js/input/tex/base/BaseMethods.js';
import { HandlerType } from '@mathjax/src/js/input/tex/HandlerTypes.js';
import type { ParseMethod } from '@mathjax/src/js/input/tex/Types.js';
import { readTeXGroup } from '../core/definitionParser';

import { formatSiNumber, type SiOptions } from './siNumber';
import { WeightedLru } from '../core/weightedLru';
import { ensureCaretInMath } from '../core/markdownTable';
import { SI_CELLS_KEY, type SiCell } from './siAlignment';
export { formatSiNumber } from './siNumber';
export const SI_OPTIONS_KEY = 'silk-si-options';
export const SI_PRELUDE_KEY = 'silk-si-prelude';
const EMPTY_OPTIONS: SiOptions = Object.freeze(Object.create(null) as Record<string, string>);
const optionCache = new WeightedLru<SiOptions>(64, 32 * 1024);

/** 只拆顶层逗号，保留 {,}、分组分隔符等 TeX 参数。 */
export function parseSiOptions(source: string): SiOptions {
  if (!source.trim()) return EMPTY_OPTIONS;
  const cached = optionCache.get(source);
  if (cached) return cached;
  const result: Record<string, string> = Object.create(null);
  let start = 0;
  let depth = 0;
  for (let i = 0; i <= source.length; i += 1) {
    if (source[i] === '\\') { i += 1; continue; }
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (i < source.length && (source[i] !== ',' || depth !== 0)) continue;
    const item = source.slice(start, i).trim();
    const equal = item.indexOf('=');
    const key = equal < 0 ? item : item.slice(0, equal).trim();
    let value = equal < 0 ? 'true' : item.slice(equal + 1).trim();
    const group = readTeXGroup(value, 0);
    if (group?.end === value.length) value = group.content;
    if (key) result[key] = value;
    start = i + 1;
  }
  Object.freeze(result);
  optionCache.set(source, result, source.length * 4 + Object.keys(result).length * 128);
  return result;
}

/** 仅展开 MathJax 已加载的字符串宏，支持数值常量和带参数包装；有界防止递归宏卡住。 */
function expandStringMacros(parser: TexParser, source: string): string {
  const main = parser instanceof TextParser ? parser.texParser : parser;
  let output = source;
  const token = /\\[A-Za-z@]+/g;
  let expansions = 0;
  for (let match = token.exec(output); match; match = token.exec(output)) {
    const name = match[0].slice(1);
    const macro = main.lookup(HandlerType.MACRO, name);
    if (macro?._func !== BaseMethods.Macro || typeof macro.args[0] !== 'string') continue;
    if (++expansions > 128 || output.length > 64 * 1024) throw new Error('宏展开超过预览上限');
    const count = Number(macro.args[1] ?? 0);
    if (!Number.isInteger(count) || count < 0 || count > 9) continue;
    const args: string[] = [];
    let end = token.lastIndex;
    if (count && typeof macro.args[2] === 'string') {
      while (/\s/.test(output[end] ?? '') && end < output.length) end += 1;
      const optional = readTeXGroup(output, end, '[', ']');
      args.push(optional?.content ?? macro.args[2]);
      if (optional) end = optional.end;
    }
    let complete = true;
    while (args.length < count) {
      while (/\s/.test(output[end] ?? '') && end < output.length) end += 1;
      const group = readTeXGroup(output, end);
      if (group) { args.push(group.content); end = group.end; continue; }
      const atom = /^\\(?:[A-Za-z@]+|.)|^[^{}]/.exec(output.slice(end))?.[0];
      if (!atom) { complete = false; break; }
      args.push(atom); end += atom.length;
    }
    if (!complete) continue;
    const replacement = macro.args[0].replace(/#([1-9])/g, (_all, index: string) => args[Number(index) - 1] ?? '');
    output = output.slice(0, match.index) + replacement + output.slice(end);
    token.lastIndex = match.index;
  }
  return output;
}

const UNIT_SYMBOLS: Readonly<Record<string, string>> = {
  metre: 'm', meter: 'm', gram: 'g', kilogram: 'kg', second: 's', ampere: 'A',
  kelvin: 'K', mole: 'mol', candela: 'cd', radian: 'rad', steradian: 'sr',
  hertz: 'Hz', newton: 'N', pascal: 'Pa', joule: 'J', watt: 'W', coulomb: 'C',
  volt: 'V', farad: 'F', ohm: '\\Omega', siemens: 'S', weber: 'Wb', tesla: 'T',
  henry: 'H', lumen: 'lm', lux: 'lx', becquerel: 'Bq', gray: 'Gy', sievert: 'Sv',
  katal: 'kat', litre: 'l', liter: 'l', day: 'd', hour: 'h', minute: 'min',
  electronvolt: 'eV', dalton: 'Da', atomicmassunit: 'u', astronomicalunit: 'au',
  degreeCelsius: '{}^{\\circ}C', celsius: '{}^{\\circ}C', degree: '{}^{\\circ}',
  arcminute: "{}^{\\prime}", arcsecond: "{}^{\\prime\\prime}", percent: '\\%',
  bar: 'bar', angstrom: '\\text{Å}', decibel: 'dB', bit: 'bit', byte: 'B',
};
const PREFIXES: Readonly<Record<string, string>> = {
  quetta: 'Q', ronna: 'R', yotta: 'Y', zetta: 'Z', exa: 'E', peta: 'P', tera: 'T',
  giga: 'G', mega: 'M', kilo: 'k', hecto: 'h', deca: 'da', deci: 'd', centi: 'c',
  milli: 'm', micro: '\\mu', nano: 'n', pico: 'p', femto: 'f', atto: 'a',
  zepto: 'z', yocto: 'y', ronto: 'r', quecto: 'q', kibi: 'Ki', mebi: 'Mi', gibi: 'Gi',
};
const UNIT_ALIASES: Readonly<Record<string, string>> = {
  m: '\\metre', s: '\\second', g: '\\gram', kg: '\\kilogram', A: '\\ampere',
  K: '\\kelvin', mol: '\\mole', cd: '\\candela', Hz: '\\hertz', N: '\\newton',
  Pa: '\\pascal', J: '\\joule', W: '\\watt', C: '\\coulomb', V: '\\volt',
  F: '\\farad', ohm: '\\Omega', cm: '\\centi\\metre', mm: '\\milli\\metre',
  km: '\\kilo\\metre', ms: '\\milli\\second', us: '\\micro\\second',
  ns: '\\nano\\second', kHz: '\\kilo\\hertz', MHz: '\\mega\\hertz', GHz: '\\giga\\hertz',
  mL: '\\milli\\litre', eV: '\\electronvolt', keV: '\\kilo\\electronvolt',
};

const unitCache = new WeightedLru<string>(64, 32 * 1024);
export function clearSiCaches(): void { unitCache.clear(); optionCache.clear(); }

interface UnitFactor { body: string; power: string }
function invertPower(power: string): string {
  return power.startsWith('-') ? power.slice(1) : '-' + power.replace(/^\+/, '');
}

/** Parse only the units used. No per-cell TeX declarations or mutable unit aliases. */
function formatUnit(source: string, parser: TexParser, options: SiOptions): string {
  const expanded = expandStringMacros(parser, source).replace(/\\([A-Za-z@]+)/g,
    (token, name: string) => UNIT_SYMBOLS[name] ? token : UNIT_ALIASES[name] ?? token);
  const product = options['inter-unit-product'] ?? '\\,';
  const mode = options['per-mode'] ?? 'reciprocal';
  const perSymbol = options['per-symbol'] ?? '/';
  const sticky = options['sticky-per'] === 'true';
  const key = JSON.stringify([expanded, product, mode, perSymbol, sticky]);
  const cached = unitCache.get(key);
  if (cached !== undefined) return cached;
  let result: string;
  if (!/\\[A-Za-z]/.test(expanded)) {
    // siunitx literal units are already formatted: per-mode only interprets symbolic units.
    result = `\\mathrm{${expanded.replace(/\./g, () => product)}}`;
  } else {
    const factors: UnitFactor[] = [];
    let prefix = '';
    let reciprocal = false;
    let power = '1';
    let cursor = 0;
    const add = (body: string): void => {
      factors.push({ body: prefix + body, power: reciprocal ? invertPower(power) : power });
      prefix = ''; power = '1';
      if (!sticky) reciprocal = false;
    };
    while (cursor < expanded.length) {
      if (/\s|\./.test(expanded[cursor]!)) { cursor++; continue; }
      const token = /^\\([A-Za-z@]+|.)/.exec(expanded.slice(cursor));
      if (!token) {
        const group = readTeXGroup(expanded, cursor);
        if (group) { add(`\\mathrm{${group.content}}`); cursor = group.end; continue; }
        const literal = /^[^\\{}\s.]+/.exec(expanded.slice(cursor))?.[0] ?? expanded[cursor]!;
        add(`\\mathrm{${literal}}`); cursor += literal.length; continue;
      }
      const name = token[1]!;
      cursor += token[0].length;
      if (name === 'per') { reciprocal = true; continue; }
      if (name in PREFIXES) { prefix += `\\mathrm{${PREFIXES[name]}}`; continue; }
      if (name in UNIT_SYMBOLS) { add(`\\mathrm{${UNIT_SYMBOLS[name]}}`); continue; }
      while (/\s/.test(expanded[cursor] ?? '') && cursor < expanded.length) cursor++;
      const group = readTeXGroup(expanded, cursor);
      if (name === 'square' || name === 'cubic' || name === 'raiseto') {
        power = name === 'square' ? '2' : name === 'cubic' ? '3' : group?.content ?? '1';
        if (name === 'raiseto' && group) cursor = group.end;
        continue;
      }
      if (name === 'squared' || name === 'cubed' || name === 'tothe') {
        const last = factors.at(-1);
        const exponent = name === 'squared' ? '2' : name === 'cubed' ? '3' : group?.content ?? '1';
        if (last) last.power = last.power.startsWith('-') ? invertPower(exponent) : exponent;
        if (name === 'tothe' && group) cursor = group.end;
        continue;
      }
      if (name === 'of' && group && factors.length) {
        factors.at(-1)!.body += `_{\\mathrm{${group.content}}}`;
        cursor = group.end; continue;
      }
      add(token[0] + (group ? `{${group.content}}` : ''));
      if (group) cursor = group.end;
    }
    if (prefix) add('');
    const render = (factor: UnitFactor, positive = false): string => {
      const exponent = positive ? factor.power.replace(/^-/, '') : factor.power;
      return `{${factor.body}}${exponent === '1' ? '' : `^{${exponent}}`}`;
    };
    const numerator = factors.filter((factor) => !factor.power.startsWith('-'));
    const denominator = factors.filter((factor) => factor.power.startsWith('-'));
    if ((mode === 'fraction' || mode === 'symbol') && denominator.length) {
      const top = numerator.map((factor) => render(factor)).join(product) || '1';
      const bottom = denominator.map((factor) => render(factor, true)).join(product);
      result = mode === 'fraction' ? `\\frac{${top}}{${bottom}}`
        : `${top}${perSymbol}${denominator.length > 1 ? `(${bottom})` : bottom}`;
    } else {
      result = (mode === 'reciprocal-positive-first' ? [...numerator, ...denominator] : factors)
        .map((factor) => render(factor)).join(product);
    }
  }
  unitCache.set(key, result, (key.length + result.length) * 2);
  return result;
}

function pushMath(parser: TexParser, tex: string): void {
  const main = parser instanceof TextParser ? parser.texParser : parser;
  const node = new TexParser(tex, { ...main.stack.env }, main.configuration).mml();
  if (parser instanceof TextParser) {
    parser.saveText();
    parser.PushMath(node);
  } else parser.Push(node);
}

function numberSeries(source: string, mode: string, options: SiOptions): string[] {
  const pieces = mode === 'list' ? source.split(';') : mode === 'product' ? source.split(/\s*[x×]\s*/) : [source];
  return pieces.map((part) => formatSiNumber(part, options));
}

function currentOptions(parser: TexParser): SiOptions {
  const main = parser instanceof TextParser ? parser.texParser : parser;
  const inherited = main.stack.env[SI_OPTIONS_KEY];
  const local = parser.stack.env[SI_OPTIONS_KEY];
  const base = parser.configuration.packageData.get(SI_OPTIONS_KEY) as SiOptions | undefined;
  if (typeof inherited !== 'string' && typeof local !== 'string') return base ?? EMPTY_OPTIONS;
  return { ...parser.configuration.packageData.get(SI_OPTIONS_KEY),
    ...(typeof inherited === 'string' ? JSON.parse(inherited) : {}),
    ...(typeof local === 'string' && local !== inherited ? JSON.parse(local) : {}) };
}

function tableNumber(parser: TexParser, name: string): void {
  let options = { ...currentOptions(parser), ...parseSiOptions(parser.GetArgument(name)) };
  const source = parser.GetArgument(name);
  let caret = '';
  let value = source.replace(/\$?(\\class\{silk-math-caret\}\{\\rule(?:\[[^\]]*\])?\{[^{}]*\}\{[^{}]*\}\})\$?/g,
    (_match, marker: string) => { caret = marker; return ''; }).trim();
  value = expandStringMacros(parser, value);
  if (/^\\num\b/.test(value)) {
    let cursor = 4;
    while (/\s/.test(value[cursor] ?? '') && cursor < value.length) cursor++;
    const optional = readTeXGroup(value, cursor, '[', ']');
    if (optional) { options = { ...options, ...parseSiOptions(optional.content) }; cursor = optional.end; }
    while (/\s/.test(value[cursor] ?? '') && cursor < value.length) cursor++;
    const argument = readTeXGroup(value, cursor);
    if (argument?.end === value.length) value = expandStringMacros(parser, argument.content);
  }
  if (!/^[+\-]?\d*(?:[.,]\d*)?(?:\(\d+\))?(?:[eEdD][+\-]?\d+)?$/.test(value)
    || !/\d/.test(value) || options['parse-numbers'] === 'false') {
    pushMath(parser, `\\text{${ensureCaretInMath(source)}}`);
    return;
  }
  const formatted = formatSiNumber(value, options);
  const split = /\{[.,]\}/.exec(formatted) ?? /\\times|\\cdot|\\pm|\(/.exec(formatted);
  const at = split?.index ?? formatted.length;
  const node = (tex: string) => new TexParser(tex, { ...parser.stack.env }, parser.configuration).mml();
  const left = parser.create('node', 'mpadded', [node(formatted.slice(0, at))], { class: 'silk-si-integer' });
  const right = parser.create('node', 'mpadded', [node(formatted.slice(at) + (caret ? `\\rlap{${caret}}` : ''))], { class: 'silk-si-decimal' });
  const cells = (parser.configuration.packageData.get(SI_CELLS_KEY) ?? []) as SiCell[];
  cells.push({ left, right });
  parser.configuration.packageData.set(SI_CELLS_KEY, cells);
  parser.Push(parser.create('node', 'mrow', [left, right]));
}

function quantity(parser: TexParser, name: string): void {
  const inherited = currentOptions(parser);
  const optional = parser.GetBrackets(name, '');
  const options = optional ? { ...inherited, ...parseSiOptions(optional) } : inherited;
  const command = name.replace(/^\\/, '');
  if (command === 'si' || command === 'unit') {
    pushMath(parser, formatUnit(parser.GetArgument(name), parser, options));
    return;
  }
  const source = expandStringMacros(parser, parser.GetArgument(name));
  if (command === 'ang') {
    const signs = ['^{\\circ}', '^{\\prime}', '^{\\prime\\prime}'];
    pushMath(parser, source.split(';').slice(0, 3).map((part, i) =>
      part.trim() ? `{${formatSiNumber(part, options)}}${signs[i]}` : '',
    ).join('\\,'));
    return;
  }
  const mode = command.endsWith('range') ? 'range' : command.endsWith('list') ? 'list' : command.endsWith('product') ? 'product' : 'single';
  let values = numberSeries(source, mode, options);
  if (mode === 'range') values.push(formatSiNumber(expandStringMacros(parser, parser.GetArgument(name)), options));
  const hasUnit = /^(SI|qty)/.test(command);
  // v2 的 \SI{number}[pre-unit]{unit} 仍很常见。
  const prefix = hasUnit && command.startsWith('SI') ? parser.GetBrackets(name, '') : '';
  const unit = hasUnit ? formatUnit(parser.GetArgument(name), parser, options) : '';
  const separator = mode === 'range' ? `\\text{${options['range-phrase'] ?? '–'}}`
    : mode === 'product' ? '\\times' : `\\text{${options['list-separator'] ?? ', '}}`;
  const repeat = mode !== 'single' && (options[`${mode}-units`] ?? 'repeat') === 'repeat';
  if (unit) values = values.map((value) => value.includes('\\pm ') && !value.startsWith('(') ? `(${value})` : value);
  if (unit && repeat) values = values.map((value) => `${value}\\,${unit}`);
  const result = values.join(separator);
  pushMath(parser, `${prefix ? formatUnit(prefix, parser, options) : ''}${result}${unit && !repeat ? `\\,${unit}` : ''}`);
}

function setup(parser: TexParser, name: string): void {
  const settings = parseSiOptions(parser.GetArgument(name));
  const options = { ...currentOptions(parser), ...settings };
  parser.stack.env[SI_OPTIONS_KEY] = JSON.stringify(options);
  if (parser.configuration.packageData.get(SI_PRELUDE_KEY)) {
    parser.configuration.packageData.set(SI_OPTIONS_KEY, options);
  }
}

function ensureMath(parser: TexParser, name: string): void {
  pushMath(parser, parser.GetArgument(name));
}

const commands = ['num', 'numrange', 'numlist', 'numproduct', 'SI', 'si', 'unit',
  'SIrange', 'SIlist', 'SIproduct', 'ang'];
const quantityCommands = ['qty', 'qtyrange', 'qtylist', 'qtyproduct'];
function commandMethod(method: (parser: TexParser, name: string) => void): ParseMethod {
  return (parser, name) => { if (typeof name === 'string') method(parser, name); };
}
new CommandMap('silk-si', Object.fromEntries(commands.map((name) => [name, commandMethod(quantity)])));
new CommandMap('silk-qty', Object.fromEntries(quantityCommands.map((name) => [name, commandMethod(quantity)])));
new CommandMap('silk-setup', { sisetup: commandMethod(setup), ensuremath: commandMethod(ensureMath), silkSCell: commandMethod(tableNumber) });

/** textmacros 的分发表必须先让用户的同名字符串宏生效。 */
function textCommand(parser: TexParser, name: string): void {
  if (!(parser instanceof TextParser)) return;
  const main = parser.texParser;
  const macro = main.lookup(HandlerType.MACRO, name.replace(/^\\/, ''));
  if (macro?._func === BaseMethods.Macro) {
    main.parse(HandlerType.MACRO, [parser, name.replace(/^\\/, '')]);
    return;
  }
  if (name.replace(/^\\/, '') === 'ensuremath') ensureMath(parser, name);
  else if (name.replace(/^\\/, '') === 'sisetup') setup(parser, name);
  else quantity(parser, name);
}
new CommandMap('silk-text-si', Object.fromEntries([...commands, 'sisetup', 'ensuremath']
  .map((name) => [name, commandMethod(textCommand)])));
new CommandMap('silk-text-qty', Object.fromEntries(quantityCommands.map((name) => [name, commandMethod(textCommand)])));

Configuration.create('silk-si', { handler: { macro: ['silk-si', 'silk-setup'] } });
Configuration.create('silk-qty', { handler: { macro: ['silk-qty'] } });
Configuration.create('silk-text-si', { parser: 'text', handler: { macro: ['silk-text-si'] } });
Configuration.create('silk-text-qty', { parser: 'text', handler: { macro: ['silk-text-qty'] } });
