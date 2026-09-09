import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 从 CHANGELOG 提取指定版本；发布前要求中文和英文条目完整配对。 */
export function extractReleaseNotes(changelog, version) {
  const text = changelog.replace(/\r\n/g, '\n');
  const headings = [...text.matchAll(/^##[ \t]+(\S+)[^\n]*$/gm)];
  const matches = headings.filter((heading) => heading[1] === version);
  if (matches.length !== 1) {
    throw new Error(`CHANGELOG.md: expected exactly one entry for ${version}; found ${matches.length}.`);
  }

  const heading = matches[0];
  const next = headings[headings.indexOf(heading) + 1];
  const notes = text.slice(heading.index + heading[0].length, next?.index ?? text.length).trim();
  const languages = [...notes.matchAll(/^###[ \t]+([^\n]+)$/gm)];
  if (languages.length !== 2 || languages[0][1].trim() !== '中文' || languages[1][1].trim() !== 'English') {
    throw new Error(`CHANGELOG.md ${version}: add "### 中文" followed by "### English".`);
  }

  const chinese = notes.slice(languages[0].index + languages[0][0].length, languages[1].index).trim();
  const english = notes.slice(languages[1].index + languages[1][0].length).trim();
  const chineseItems = chinese.match(/^-[ \t]+\S[^\n]*$/gm) ?? [];
  const englishItems = english.match(/^-[ \t]+\S[^\n]*$/gm) ?? [];
  if (!/[\u3400-\u9fff]/u.test(chinese) || !/[A-Za-z]{2,}/.test(english) ||
      chineseItems.length === 0 || chineseItems.length !== englishItems.length) {
    throw new Error(`CHANGELOG.md ${version}: provide Chinese and English release notes with matching, non-empty bullet lists.`);
  }
  return `${notes}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(import.meta.dirname, '..');
    const version = process.argv[2] ?? JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
    process.stdout.write(extractReleaseNotes(readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8'), version));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
