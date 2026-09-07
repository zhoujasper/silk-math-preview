export type SiOptions = Readonly<Record<string, string>>;
interface Decimal { integer: string; fraction?: string | undefined }

function increment(digits: string): string {
  let end = digits.length;
  while (end > 0 && digits[end - 1] === '9') end--;
  return end ? digits.slice(0, end - 1) + String(Number(digits[end - 1]) + 1) + '0'.repeat(digits.length - end)
    : '1' + '0'.repeat(digits.length);
}

function magnitude(value: Decimal): number {
  const digits = value.integer + (value.fraction ?? '');
  const first = digits.search(/[1-9]/);
  return first < 0 ? 0 : value.integer.length - first - 1;
}

/** Exact decimal quantization, including ties and carries, without binary floats. */
function quantize(value: Decimal, places: number, options: SiOptions): Decimal {
  const fraction = value.fraction ?? '';
  if (options['round-pad'] === 'false' && places >= fraction.length) return value;
  const digits = value.integer + fraction;
  const cut = value.integer.length + places;
  let kept = cut <= 0 ? '0' : digits.slice(0, cut).padEnd(cut, '0');
  const discarded = digits.slice(Math.max(0, cut));
  const first = cut < 0 ? '0' : discarded[0] ?? '0';
  const nonzero = /[1-9]/.test(discarded);
  const direction = options['round-direction'] ?? 'nearest';
  const up = direction === 'up' ? nonzero : direction === 'down' ? false
    : first > '5' || (first === '5' && (/[1-9]/.test(discarded.slice(1))
      || options['round-half'] !== 'even' || Number(kept.at(-1)) % 2 === 1));
  if (up) kept = increment(kept);
  kept = kept.replace(/^0+(?=\d)/, '');
  if (places <= 0) return { integer: kept === '0' ? '0' : kept + '0'.repeat(-places) };
  kept = kept.padStart(places + 1, '0');
  return { integer: kept.slice(0, -places), fraction: kept.slice(-places) };
}

function roundValue(value: Decimal, precision: number, options: SiOptions): Decimal {
  const figures = options['round-mode'] === 'figures';
  if (figures && precision <= 0) return { integer: '0' };
  const places = figures ? precision - magnitude(value) - 1 : precision;
  if (Math.abs(places) > 1000) return value;
  let rounded = quantize(value, places, options);
  // A carry can add an integer digit: 9.99 at two figures is 10, not 10.0.
  if (figures && magnitude(rounded) > magnitude(value)) {
    rounded = quantize(rounded, precision - magnitude(rounded) - 1, options);
  }
  return rounded;
}

function uncertaintyValue(digits: string, fractionLength: number): Decimal {
  if (/[.,]/.test(digits)) {
    const [integer, fraction] = digits.split(/[.,]/);
    return { integer: integer || '0', fraction };
  }
  const padded = digits.padStart(fractionLength + 1, '0');
  return { integer: (fractionLength ? padded.slice(0, -fractionLength) : padded).replace(/^0+(?=\d)/, ''),
    ...(fractionLength ? { fraction: padded.slice(-fractionLength) } : {}) };
}

/** Linear grouping; a look-ahead regex on every digit is quadratic on long integers. */
function groupDigits(digits: string, separator: string, fromRight: boolean): string {
  const pieces: string[] = [];
  let cursor = fromRight ? digits.length % 3 || 3 : 3;
  pieces.push(digits.slice(0, cursor));
  for (; cursor < digits.length; cursor += 3) pieces.push(digits.slice(cursor, cursor + 3));
  return pieces.join(separator);
}

function formatDecimal(value: Decimal, options: SiOptions): string {
  let { integer, fraction } = value;
  const minimum = Math.max(1, Number.parseInt(options['group-minimum-digits'] ?? '5', 10) || 5);
  const group = options['group-digits'] ?? 'all';
  const separator = options['group-separator'] ?? '\\,';
  if (group !== 'false' && group !== 'none') {
    if (group !== 'decimal' && integer.length >= minimum) integer = groupDigits(integer, separator, true);
    if (group !== 'integer' && fraction && fraction.length >= minimum) fraction = groupDigits(fraction, separator, false);
  }
  const marker = options['output-decimal-marker'] ?? (/^(DE|FR|IT|ES|PL|RU)$/.test(options.locale ?? '') ? ',' : '.');
  return integer + (fraction === undefined ? '' : `{${marker}}${fraction}`);
}

export function formatSiNumber(source: string, options: SiOptions = {}): string {
  if (options['parse-numbers'] === 'false') return source;
  const input = source.trim().replace(/\s+/g, '').replace(/−/g, '-');
  const match = /^(?:(\\pm|\\mp|\\leq?|\\geq?|[<>±∓]))?([+-]?)(\d*)(?:[.,](\d*))?(?:\((\d+(?:[.,]\d+)?)\))?(?:[eEdD]([+-]?\d+))?$/.exec(input);
  if (!match || !(match[3] || match[4])) return source;
  let value: Decimal = { integer: match[3] || '0', fraction: match[4] };
  let uncertainty = match[5];
  let absolute = uncertainty === undefined ? undefined : uncertaintyValue(uncertainty, match[4]?.length ?? 0);
  const precision = Number(options['round-precision'] ?? 2);
  const rounding = options['round-mode'];
  if (Number.isInteger(precision) && Math.abs(precision) <= 1000) {
    if (!absolute && (rounding === 'places' || rounding === 'figures')) value = roundValue(value, precision, options);
    else if (absolute && rounding === 'uncertainty' && precision > 0 && /[1-9]/.test(uncertainty!)) {
      absolute = roundValue(absolute, precision, { ...options, 'round-mode': 'figures',
        'round-direction': options['uncertainty-round-direction'] ?? 'nearest' });
      const places = precision - magnitude(absolute) - 1;
      if (Math.abs(places) <= 1000) {
        value = quantize(value, places, { ...options, 'round-pad': 'true' });
        uncertainty = (absolute.integer + (absolute.fraction ?? '')).replace(/^0+(?=\d)/, '');
      }
    }
  }
  let sign = match[2] ?? '';
  if (rounding && rounding !== 'none' && sign === '-' && !/[1-9]/.test(value.integer + (value.fraction ?? ''))
    && options['retain-negative-zero'] !== 'true') sign = '';
  let mantissa = `${match[1] ?? ''}${sign}${formatDecimal(value, options)}`;
  const separate = options['uncertainty-mode'] === 'separate' || options['separate-uncertainty'] === 'true';
  if (absolute) {
    mantissa += separate ? `\\pm ${formatDecimal(absolute, options)}`
      : `${options['uncertainty-separator'] ?? ''}${options['output-open-uncertainty'] ?? '('}${options['uncertainty-mode'] === 'full'
        ? formatDecimal(absolute, options) : uncertainty}${options['output-close-uncertainty'] ?? ')'}`;
  }
  const exponent = match[6];
  if (exponent === undefined) return mantissa;
  if (absolute && separate && options['bracket-ambiguous-numbers'] !== 'false') mantissa = `(${mantissa})`;
  return `${mantissa}${options['exponent-product'] ?? '\\times'}10^{${exponent.replace(/^\+/, '').replace(/^(-?)0+(?=\d)/, '$1')}}`;
}
