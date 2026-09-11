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

function normalizeCommand(value: string): string | undefined {
  const name = value.startsWith('\\') ? value.slice(1) : value;
  return COMMAND_NAME.test(name) ? name : undefined;
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
