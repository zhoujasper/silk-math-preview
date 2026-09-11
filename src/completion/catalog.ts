import { DEFAULT_MATH_ENVIRONMENTS } from '../core/completionCatalog';
import type { ParsedDefinition } from '../core/definitionParser';
import { SYMBOL_PACKAGES } from './symbols.generated';

export interface MathCompletion {
  readonly name: string;
  readonly signature: string;
  /** VS Code snippet grammar, including the initial escaped backslash. */
  readonly body: string;
  readonly detail: string;
  readonly kind: 'command' | 'environment';
  readonly priority: number;
  readonly definition?: ParsedDefinition;
}

export interface CatalogOptions {
  readonly packages: readonly string[];
  readonly commands: readonly ParsedDefinition[];
  readonly environments: readonly string[];
  readonly environmentDefinitions: readonly ParsedDefinition[];
  readonly snippets: Readonly<Record<string, string>>;
  readonly optionalArguments: boolean;
}

export function escapeSnippet(text: string): string {
  return text.replace(/[\\$}]/g, '\\$&');
}

function argumentsBody(count: number): string {
  return Array.from({ length: count }, (_, i) => `{\$${i + 1}}`).join('');
}

function definitionArguments(definition: ParsedDefinition): { signature: string; body: string } {
  let signature = '';
  let body = '';
  for (const arg of definition.arguments) {
    const [open, close] = arg.kind === 'optional' ? ['[', ']'] : ['{', '}'];
    signature += open + close;
    body += open + '${' + arg.index + ':' + escapeSnippet(arg.defaultValue ?? '') + '}' + close;
  }
  return { signature, body };
}

/** MathJax names, independently authored templates, then document/user overrides. */
export function buildMathCatalog(options: CatalogOptions): readonly MathCompletion[] {
  const entries = new Map<string, MathCompletion>();
  const commandKeys = new Map<string, Set<string>>();
  const enabled = new Set(['base', 'ams', 'cancel', 'boldsymbol', 'color', ...options.packages]);
  const put = (key: string, entry: MathCompletion): void => {
    entries.set(key, entry);
    if (entry.kind === 'command') {
      const keys = commandKeys.get(entry.name) ?? new Set<string>();
      keys.add(key);
      commandKeys.set(entry.name, keys);
    }
  };
  const remove = (name: string): void => {
    for (const key of commandKeys.get(name) ?? []) entries.delete(key);
    commandKeys.delete(name);
  };
  const command = (name: string, args = '', signature = '', detail = '数学命令 / Math command', priority = 2): void => {
    put(`command:${name}:${signature}`, {
      name, signature, body: escapeSnippet('\\' + name) + args, detail, kind: 'command', priority,
    });
  };
  const replace = (names: string, count: number): void => {
    for (const name of names.split(' ')) {
      remove(name);
      command(name, argumentsBody(count), '{}'.repeat(count));
    }
  };
  for (const [pkg, symbols] of SYMBOL_PACKAGES) {
    if (!enabled.has(pkg)) continue;
    for (const [name, glyph, arity] of symbols) {
      remove(name);
      command(name, argumentsBody(arity), '{}'.repeat(arity), `${glyph ? glyph + ' · ' : ''}${pkg}`);
    }
  }
  replace('frac dfrac tfrac cfrac binom dbinom tbinom overset underset stackrel', 2);
  replace('xrightarrow xleftarrow', 1);
  replace('overunderset', 3);
  replace('sqrt text textrm textbf textit textsf texttt textnormal textup textmd textsc emph hbox mbox operatorname mathrm mathbf mathit mathbb mathcal mathscr mathfrak mathsf mathtt mathnormal boldsymbol bm boxed overline underline hat widehat bar vec dot ddot dddot ddddot tilde widetilde breve check acute grave mathring overbrace underbrace overrightarrow overleftarrow underrightarrow underleftarrow overleftrightarrow underleftrightarrow phantom hphantom vphantom smash cancel bcancel xcancel not ensuremath', 1);
  replace('genfrac', 6);
  replace('cancelto', 2);
  replace('textcolor colorbox', 2);
  replace('fcolorbox', 3);
  replace('color', 1);
  replace('vbox clap llap rlap textsl hspace hspace* vspace vspace* leftroot uproot mspace shoveright shoveleft tag', 1);
  replace('sideset', 3);
  replace('operatorname*', 1);
  replace('mathop mathrel mathbin mathord mathopen mathclose mathpunct mathinner', 1);
  replace('rule', 2);
  replace('mathds', 1);
  replace('num numlist ang unit si', 1);
  replace('SI SIlist numrange', 2);
  replace('SIrange qtyrange', 3);
  replace('sisetup', 1);
  replace('label ref eqref pageref autoref cref Cref vref nameref cite citep citet citeyear shortcite textcite parencite autocite', 1);
  if (enabled.has('braket')) replace('braket Braket set Set', 1);
  if (!enabled.has('physics')) replace('qty', 2);
  else {
    replace('qty quantity pqty bqty Bqty vqty abs absolutevalue norm eval evaluated order', 1);
    replace('comm commutator anticommutator acomm poissonbracket pb', 2);
    replace('dv pdv fdv derivative partialderivative pderivative functionalderivative fderivative', 2);
    replace('Im PV Re curl dd differential div divergence expval expectationvalue grad gradient laplacian pv principalvalue Res qq qqtext va vectorarrow var variation vb vectorbold vu vectorunit ev bra ket', 1);
    replace('braket dyad ip innerproduct outerproduct ketbra op', 2);
    replace('mel matrixelement matrixel', 3);
    replace('mqty matrixquantity smqty smallmatrixquantity imat identitymatrix pmat paulimatrix dmat diagonalmatrix admat antidiagonalmatrix', 1);
    replace('xmat xmatrix', 3);
    command('ev', '{$1}{$2}', '{}{}');
    command('pdv', '{$1}{$2}{$3}', '{}{}{}');
    command('eval', '{$1}_{$2}^{$3}', '{}_{}^{}');
    if (options.optionalArguments) {
      command('dd', '[$2]{$1}', '[]{}');
      for (const name of ['dv', 'pdv', 'fdv']) command(name, '[${3:2}]{$1}{$2}', '[]{}{}');
    }
  }
  if (enabled.has('mathtools')) {
    replace('mathclap mathllap mathrlap overbracket underbracket mathtoolsset mathmbox mathmakebox cramped crampedllap crampedrlap crampedclap usetagform refeq Aboxed vdotswithin shortvdotswithin xmathstrut', 1);
    replace('prescript', 3);
    replace('splitfrac splitdfrac', 2);
    replace('newtagform renewtagform DeclarePairedDelimiter', 3);
    for (const name of ['DeclarePairedDelimiterX', 'DeclarePairedDelimiterXPP', 'adjustlimits']) remove(name);
    command('DeclarePairedDelimiterX', '{$1}[${2:1}]{$3}{$4}{$5}', '{}[]{}{}{}');
    command('DeclarePairedDelimiterXPP', '{$1}[${2:1}]{$3}{$4}{$5}{$6}{$7}', '{}[]{}{}{}{}{}');
    command('adjustlimits', '{$1}_{$2}{$3}_{$4}', '{}_{}{}_{}');
    for (const entry of [...entries.values()]) if (/^x.*(?:arrow|harpoon|mapsto)/.test(entry.name)) {
      replace(entry.name, 1);
      if (options.optionalArguments) command(entry.name, '[$2]{$1}', '[]{}');
    }
  }
  remove('left');
  for (const [name, delimiter, closing] of [
    ['left', '(', ')'], ['left', '[', ']'], ['left', '\\{', '\\}'],
    ['left', '|', '|'], ['left', '\\lVert', '\\rVert'], ['left', '\\langle', '\\rangle'],
  ]) command(name!, escapeSnippet(delimiter!) + '$1' + escapeSnippet('\\right' + closing) + '$0', delimiter!);
  for (const name of ['sum', 'prod', 'coprod', 'int', 'iint', 'iiint', 'oint']) {
    command(name, '_{$1}^{$2} $0', '_{}^{}');
  }
  command('lim', '_{${1:x} ' + escapeSnippet('\\to') + ' ${2:0}} $0', '_{}');
  if (options.optionalArguments) {
    command('sqrt', '[${1:n}]{$2}$0', '[]{}');
    command('cfrac', '[${3:l}]{$1}{$2}$0', '[]{}{}');
    for (const name of ['xrightarrow', 'xleftarrow']) command(name, '[$2]{$1}$0', '[]{}');
    command('rule', '[${3:0pt}]{$1}{$2}', '[]{}{}');
    for (const name of ['cite', 'citep', 'citet', 'textcite', 'parencite', 'autocite']) {
      command(name, '[$2]{$1}', '[]{}');
      command(name, '[$2][$3]{$1}', '[][]{}');
    }
  }
  for (const name of ['xrightarrow', 'xleftarrow']) command(name, '{$1}$0', '{}');
  const environments = new Set([...DEFAULT_MATH_ENVIRONMENTS,
    'array', 'subarray', 'eqnarray', 'eqnarray*', 'subequations', 'matrix', 'pmatrix', 'bmatrix',
    'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix', 'cases', ...options.environments]);
  if (enabled.has('mathtools')) for (const name of ['dcases', 'dcases*', 'rcases', 'rcases*', 'multlined', 'matrix*', 'pmatrix*', 'bmatrix*', 'Bmatrix*', 'vmatrix*', 'Vmatrix*']) environments.add(name);
  for (const name of environments) {
    if (!/^[A-Za-z@][A-Za-z0-9@:_-]*\*?$/.test(name)) continue;
    const definition = options.environmentDefinitions.find(entry => entry.name === name);
    // Prefer a complete LaTeX environment over legacy primitive names such as \matrix.
    remove(name);
    const args = definition ? definitionArguments(definition)
      : /^(?:alignat|alignedat)\*?$/.test(name) ? { signature: '{}', body: '{${1:2}}' }
      : name === 'array' ? { signature: '{}', body: '{${1:cc}}' }
      : name === 'subarray' ? { signature: '{}', body: '{${1:c}}' }
      : { signature: '', body: '' };
    put(`environment:${name}`, {
      name, signature: args.signature, kind: 'environment', priority: definition ? 0 : 2,
      body: escapeSnippet('\\begin{' + name + '}') + args.body + '\n\t$0\n' + escapeSnippet('\\end{' + name + '}'),
      detail: definition ? '自定义数学环境 / Custom math environment' : '数学环境 / Math environment',
      ...(definition ? { definition } : {}),
    });
  }
  // Real document definitions take precedence over built-in arity, including redefinitions.
  for (const definition of options.commands) {
    const name = definition.name.replace(/^\\/, '');
    if (!/^[A-Za-z@]+$/.test(name)) continue;
    remove(name);
    const args = definitionArguments(definition);
    put(`command:${name}:${args.signature}`, {
      name, ...args, body: escapeSnippet('\\' + name) + args.body, kind: 'command', priority: 0,
      detail: '工作区自定义命令 / Workspace command', definition,
    });
  }
  remove('begin');
  command('begin', '{${1|' + [...environments].filter(name => /^[A-Za-z][A-Za-z0-9]*\*?$/.test(name)).join(',')
    + '|}}\n\t$0\n' + escapeSnippet('\\end{') + '$1' + escapeSnippet('}'), '{}', '配对环境 / Paired environment');
  for (const [rawName, body] of Object.entries(options.snippets).slice(0, 256)) {
    const name = rawName.replace(/^\\/, '');
    if (!/^[A-Za-z@]+\*?$/.test(name) || typeof body !== 'string' || body.length > 8192) continue;
    remove(name);
    if (body) put(`command:${name}`, {
      name, body, signature: '', kind: 'command', priority: 0,
      detail: '用户 snippet / User snippet',
    });
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name) || a.signature.localeCompare(b.signature));
}
