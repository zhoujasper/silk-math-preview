/** Match a single path component without regular-expression backtracking. */
function component(pattern: string, value: string): boolean {
  let p = 0, v = 0, star = -1, restart = 0;
  while (v < value.length) {
    if (pattern[p] === '*') { star = p++; restart = v; }
    else if (pattern[p] === '?' || pattern[p] === value[v]) { p++; v++; }
    else if (star >= 0) { p = star + 1; v = ++restart; }
    else return false;
  }
  while (pattern[p] === '*') p++;
  return p === pattern.length;
}

/** Bare names match anywhere; relative paths start at the workspace folder. */
export function matchesFilePattern(rule: string, path: string, relative?: string): boolean {
  const pattern = rule.trim().replaceAll('\\', '/').toLowerCase();
  if (!pattern || pattern.length > 2048) return false;
  path = path.replaceAll('\\', '/').toLowerCase();
  if (!pattern.includes('/')) return component(pattern, path.slice(path.lastIndexOf('/') + 1));
  const absolute = pattern.startsWith('/') || /^[a-z]:\//.test(pattern);
  const target = absolute ? path : relative?.replaceAll('\\', '/').toLowerCase();
  if (target === undefined) return false;
  const parts = target.split('/');
  const matched = new Array<boolean>(parts.length + 1).fill(false);
  matched[0] = true;
  for (const part of pattern.replace(/^\.\//, '').split('/')) {
    if (part === '**') {
      for (let i = 1; i <= parts.length; i++) matched[i] ||= matched[i - 1]!;
    } else {
      for (let i = parts.length; i > 0; i--) matched[i] = matched[i - 1]! && component(part, parts[i - 1]!);
      matched[0] = false;
    }
  }
  return matched[parts.length]!;
}

/** Keep optional matching code out of the normal, empty-rule activation path. */
export function findExclusionRule(patterns: unknown, types: unknown, language: string, path: string, relative?: string): string | undefined {
  if (Array.isArray(patterns)) {
    for (const value of patterns.slice(0, 64)) {
      if (typeof value === 'string' && matchesFilePattern(value, path, relative)) return value;
    }
  }
  if (Array.isArray(types)) {
    path = path.toLowerCase();
    for (const value of types.slice(0, 64)) {
      if (typeof value !== 'string' || value.length > 80) continue;
      const type = value.trim().toLowerCase().replace(/^\*\./, '.');
      if (type && (type === language || path.endsWith(type.startsWith('.') ? type : `.${type}`))) return value;
    }
  }
  return undefined;
}
