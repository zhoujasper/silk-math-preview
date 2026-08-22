import { describe, expect, it } from 'vitest';

import {
  fillTemplate,
  isCancelledMessage,
  isChineseLocale,
  README_LOCALE_ANCHORS,
  resolveUiLocale,
  UI_LOCALE_IDS,
  uiCopy,
} from '../src/core/uiLocale';

describe('ui locale', () => {
  it('把 vscode 语言标签对到常见界面语言，对不上的用英文', () => {
    expect(resolveUiLocale(undefined)).toBe('en');
    expect(resolveUiLocale('')).toBe('en');
    expect(resolveUiLocale('en')).toBe('en');
    expect(resolveUiLocale('en-GB')).toBe('en');
    expect(resolveUiLocale('zh-cn')).toBe('zh-hans');
    expect(resolveUiLocale('zh-CN')).toBe('zh-hans');
    expect(resolveUiLocale('zh-hans')).toBe('zh-hans');
    expect(resolveUiLocale('zh-tw')).toBe('zh-hant');
    expect(resolveUiLocale('zh-HK')).toBe('zh-hant');
    expect(resolveUiLocale('zh-Hant-TW')).toBe('zh-hant');
    expect(resolveUiLocale('ja')).toBe('ja');
    expect(resolveUiLocale('ja-JP')).toBe('ja');
    expect(resolveUiLocale('ko-kr')).toBe('ko');
    expect(resolveUiLocale('de-DE')).toBe('de');
    expect(resolveUiLocale('fr-CA')).toBe('fr');
    expect(resolveUiLocale('es-MX')).toBe('es');
    expect(resolveUiLocale('pt-br')).toBe('pt');
    expect(resolveUiLocale('pt-PT')).toBe('pt');
    expect(resolveUiLocale('ru-RU')).toBe('ru');
    expect(resolveUiLocale('it')).toBe('it');
    expect(resolveUiLocale('tr')).toBe('en');
    expect(resolveUiLocale('qps-ploc')).toBe('en');
  });

  it('简体和繁体都算中文，但文案分开', () => {
    expect(isChineseLocale('zh-cn')).toBe(true);
    expect(isChineseLocale('zh-tw')).toBe(true);
    expect(isChineseLocale('ja')).toBe(false);
    expect(uiCopy('zh-cn').snooze).toBe('推迟');
    expect(uiCopy('zh-tw').snooze).toBe('延後');
    expect(uiCopy('zh-cn').previewSize).toBe('预览大小');
    expect(uiCopy('zh-tw').previewSize).toBe('預覽大小');
  });

  it('每种语言的字段与英文对齐，并有自己的界面文案', () => {
    const english = uiCopy('en');
    const englishKeys = Object.keys(english).sort();
    const ocrKeys = Object.keys(english.ocr).sort();
    expect(UI_LOCALE_IDS).toEqual([
      'en',
      'zh-hans',
      'zh-hant',
      'ja',
      'ko',
      'de',
      'fr',
      'es',
      'pt',
      'ru',
      'it',
    ]);
    const snoozeByLocale = {
      en: 'Snooze',
      'zh-hans': '推迟',
      'zh-hant': '延後',
      ja: '一時停止',
      ko: '일시 중지',
      de: 'Pausieren',
      fr: 'Reporter',
      es: 'Posponer',
      pt: 'Adiar',
      ru: 'Отложить',
      it: 'Posticipa',
    } as const;
    for (const id of UI_LOCALE_IDS) {
      const copy = uiCopy(id);
      expect(Object.keys(copy).sort()).toEqual(englishKeys);
      expect(Object.keys(copy.ocr).sort()).toEqual(ocrKeys);
      expect(copy.htmlLang.length).toBeGreaterThan(0);
      expect(copy.snooze).toBe(snoozeByLocale[id]);
      expect(copy.ocr.title.length).toBeGreaterThan(0);
      expect(copy.growTo).toContain('{percent}');
      expect(copy.ocr.textDone).toContain('{percent}');
    }
  });

  it('模板占位按名字替换，缺的键原样留下', () => {
    expect(fillTemplate('{product} · {time}', { product: 'Silk Math', time: '12:00' }))
      .toBe('Silk Math · 12:00');
    expect(fillTemplate('left {missing} right', {})).toBe('left {missing} right');
  });

  it('取消/cancel 都当成用户中止，不弹失败', () => {
    expect(isCancelledMessage('OCR 组件下载已取消')).toBe(true);
    expect(isCancelledMessage('Canceled')).toBe(true);
    expect(isCancelledMessage('network timeout')).toBe(false);
  });

  it('README 页内语言链接与目录一致', () => {
    expect(README_LOCALE_ANCHORS.map((item) => item.id)).toEqual([
      'english',
      'chinese',
      'chinese-traditional',
      'japanese',
      'korean',
      'german',
      'french',
      'spanish',
      'portuguese',
      'russian',
      'italian',
    ]);
    expect(README_LOCALE_ANCHORS[0]?.label).toBe('English');
  });
});
