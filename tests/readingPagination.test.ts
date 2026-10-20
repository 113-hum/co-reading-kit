import { describe, expect, it } from 'vitest';
import { pageAtOffset, paginateMeasuredText } from '../src/readingPagination';

describe('measured reading pagination', () => {
  it('preserves every source character and never divides a surrogate pair', () => {
    const text = '  清晨🌸\n\n风吹过窗台。\n'.repeat(50);
    const pages = paginateMeasuredText(text, (value) => Array.from(value).length <= 37);
    expect(pages.map((p) => text.slice(p.start, p.end)).join('')).toBe(text);
    for (const p of pages) {
      expect(Array.from(text.slice(p.start, p.end)).length).toBeLessThanOrEqual(37);
      expect(text.slice(p.start, p.end)).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
    }
  });
  it('decreases page capacity when text grows and relocates an original position', () => {
    const text = '月光和花园。'.repeat(100);
    const small = paginateMeasuredText(text, (value) => value.length <= 100);
    const large = paginateMeasuredText(text, (value) => value.length <= 40);
    expect(large.length).toBeGreaterThan(small.length);
    const offset = small[3].start;
    const p = large[pageAtOffset(large, offset)];
    expect(p.start).toBeLessThanOrEqual(offset);
    expect(p.end).toBeGreaterThan(offset);
  });
  it('reports unusable viewports rather than clipping or looping', () => {
    expect(() => paginateMeasuredText('正文', () => false)).toThrow('阅读区域太小');
    expect(paginateMeasuredText('', () => false)).toEqual([{ start: 0, end: 0 }]);
  });
});
