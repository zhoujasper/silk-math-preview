import type {
  CompletionCatalogOptions,
  CompletionEntry,
} from './types';

export const DEFAULT_MATH_ENVIRONMENTS = Object.freeze([
  'equation',
  'equation*',
  'align',
  'align*',
  'alignat',
  'alignat*',
  'aligned',
  'alignedat',
  'gather',
  'gather*',
  'gathered',
  'multline',
  'multline*',
  'split',
  'flalign',
  'flalign*',
  'displaymath',
  'math',
] as const);

export const BUILTIN_MATH_COMMANDS = Object.freeze([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta',
  'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi',
  'rho', 'sigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi',
  'Psi', 'Omega', 'frac', 'dfrac', 'tfrac', 'sqrt', 'sum', 'prod', 'int',
  'iint', 'iiint', 'lim', 'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'min',
  'max', 'left', 'right', 'middle', 'begin', 'end', 'text', 'mathrm', 'mathbf',
  'mathit', 'mathbb', 'mathcal', 'operatorname', 'overline', 'underline', 'hat',
  'bar', 'vec', 'dot', 'ddot', 'partial', 'nabla', 'infty', 'cdot', 'times',
  'pm', 'mp', 'leq', 'geq', 'neq', 'approx', 'equiv', 'in', 'notin', 'subset',
  'subseteq', 'supset', 'supseteq', 'cup', 'cap', 'langle', 'rangle', 'lvert',
  'rvert', 'lVert', 'rVert',
] as const);

/** 只收录歧义很低、编辑距离小且常见的拼写错误。 */
export const HIGH_CONFIDENCE_COMMAND_TYPOS: Readonly<Record<string, string>> =
  Object.freeze({
    alhpa: 'alpha',
    betta: 'beta',
    bgein: 'begin',
    edn: 'end',
    frca: 'frac',
    lefft: 'left',
    rigth: 'right',
    sqart: 'sqrt',
    theat: 'theta',
  });

const COMMAND_NAME = /^[A-Za-z@]+$/;
const ENVIRONMENT_NAME = /^[A-Za-z@][A-Za-z0-9@:_-]*\*?$/;

function normalizeCommand(value: string): string | undefined {
  const name = value.startsWith('\\') ? value.slice(1) : value;
  return COMMAND_NAME.test(name) ? name : undefined;
}

function normalizeEnvironment(value: string): string | undefined {
  return ENVIRONMENT_NAME.test(value) ? value : undefined;
}

export function createCompletionCatalog(
  options: CompletionCatalogOptions = {},
): readonly CompletionEntry[] {
  const entries = new Map<string, CompletionEntry>();

  const addCommand = (rawName: string, custom: boolean): void => {
    const name = normalizeCommand(rawName);
    if (name === undefined) {
      return;
    }
    const key = `command:${name}`;
    if (!entries.has(key)) {
      entries.set(key, {
        label: `\\${name}`,
        insertText: `\\${name}`,
        kind: 'command',
        detail: custom ? '工作区自定义命令' : '内置数学命令',
      });
    }
  };

  const addEnvironment = (name: string, custom: boolean): void => {
    const normalized = normalizeEnvironment(name);
    if (normalized === undefined) {
      return;
    }
    const key = `environment:${normalized}`;
    if (!entries.has(key)) {
      entries.set(key, {
        label: normalized,
        insertText: `\\begin{${normalized}}\n\t$0\n\\end{${normalized}}`,
        kind: 'environment',
        detail: custom ? '工作区自定义数学环境' : '内置数学环境',
      });
    }
  };

  for (const command of BUILTIN_MATH_COMMANDS) {
    addCommand(command, false);
  }
  for (const command of options.customCommands ?? []) {
    addCommand(command, true);
  }
  for (const environment of DEFAULT_MATH_ENVIRONMENTS) {
    addEnvironment(environment, false);
  }
  for (const environment of options.customEnvironments ?? []) {
    addEnvironment(environment, true);
  }

  return [...entries.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function getHighConfidenceCommandCorrection(
  command: string,
  additionalTypos: Readonly<Record<string, string>> = {},
): string | undefined {
  const normalized = normalizeCommand(command);
  if (normalized === undefined) {
    return undefined;
  }
  const additional = additionalTypos[normalized];
  if (additional !== undefined && normalizeCommand(additional) !== undefined) {
    return normalizeCommand(additional);
  }
  return HIGH_CONFIDENCE_COMMAND_TYPOS[normalized];
}
