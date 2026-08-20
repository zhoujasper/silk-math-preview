const CJK = /[\u3400-\u9FFF]/g;
const LATIN_WORD = /[A-Za-z]{3,}/g;
const LATEX_CMD = /\\[A-Za-z]+/g;
const MATH_MARK = /[=^_{}]|\\[A-Za-z]+|[∑∫√∞±≤≥≠≈∈∉⊂⊃∪∩∂∇α-ωΑ-Ω×÷]/g;

export function cleanRecognizedLatex(raw: string): string {
  let text = raw.replace(/\u0000/g, '').trim();
  if (!text) return '';
  text = text.replace(/^\$\$([\s\S]*?)\$\$$/u, '$1').trim();
  text = text.replace(/^\$([\s\S]*?)\$$/u, '$1').trim();
  text = text.replace(/^\\\s*\[([\s\S]*?)\\\s*\]$/u, '$1').trim();
  text = text.replace(/^\\\s*\(([\s\S]*?)\\\s*\)$/u, '$1').trim();
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

export function latexLooksDisplay(latex: string): boolean {
  const text = cleanRecognizedLatex(latex);
  return /\\\\|\\begin\s*\{|\\frac|\\int|\\sum|\\prod|\\lim/.test(text) || text.length > 48;
}

export function wrapLatex(latex: string, display = latexLooksDisplay(latex)): string {
  const body = cleanRecognizedLatex(latex);
  if (!body) return '';
  if (/^\$\$[\s\S]*\$\$$/.test(body) || /^\\\[[\s\S]*\\]$/.test(body) || /^\$(?:\\.|[^$])*\$$/.test(body)) {
    return body;
  }
  return display ? `\\[\n${body}\n\\]` : `$${body}$`;
}

export function formulaLikeness(text: string): number {
  const sample = text.trim();
  if (!sample) return 0;
  const commands = sample.match(LATEX_CMD)?.length ?? 0;
  const marks = sample.match(MATH_MARK)?.length ?? 0;
  const cjk = sample.match(CJK)?.length ?? 0;
  const words = sample.match(LATIN_WORD)?.length ?? 0;
  const length = Math.max(1, sample.length);
  const positive = (commands * 3 + marks) / Math.max(4, length / 5);
  const negative = cjk * 0.12 + words * 0.18;
  return Math.max(0, Math.min(1, positive - negative));
}

export function prefersWholeFormula(textOcr: string, latex: string, formulaOk: boolean): boolean {
  const cleaned = cleanRecognizedLatex(latex);
  if (!formulaOk || !cleaned) return false;
  const proseUnits = (textOcr.match(CJK) ?? []).length + (textOcr.match(LATIN_WORD) ?? []).length;
  if (proseUnits >= 10 && formulaLikeness(textOcr) < 0.35) return false;
  return formulaLikeness(cleaned) >= 0.35 || proseUnits < 5;
}

export interface MixedOcrLine {
  readonly text: string;
  readonly latex?: string;
  readonly useFormula: boolean;
}

export function composeMixedLines(lines: readonly MixedOcrLine[]): string {
  const chunks: string[] = [];
  for (const line of lines) {
    if (line.useFormula && line.latex) {
      const wrapped = wrapLatex(line.latex);
      if (wrapped) chunks.push(wrapped);
      continue;
    }
    const text = line.text.trim();
    if (text) chunks.push(text);
  }
  return chunks.join('\n').trim();
}

export function lineShouldTryFormula(text: string): boolean {
  return formulaLikeness(text) >= 0.42;
}
