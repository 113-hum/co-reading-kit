import { describe, expect, it } from 'vitest';
import { ReadingShareLedger, readingSourceKey, subtractRanges, type ReadingVisit } from '../src/readingShareLedger';

const source = '甲乙丙丁戊己庚辛壬癸';
function visit(start = 0, end = 4, chapterIndex = 0, bookId = 1): ReadingVisit {
  return { start, end, key: readingSourceKey(bookId, chapterIndex, source), bookId,
    chapterIndex, bookTitle: '示例', chapterTitle: `第${chapterIndex + 1}章`, text: source.slice(start, end) };
}
describe('reading share ledger', () => {
  it('batches visited pages across chapters without adding skipped content', () => {
    const ledger = new ReadingShareLedger();
    ledger.visit(visit(0, 2)); ledger.visit(visit(6, 8)); ledger.visit(visit(0, 3, 1));
    expect(ledger.pending(1, 'a').map((v) => v.text)).toEqual(['甲乙', '庚辛', '甲乙丙']);
  });
  it('deduplicates overlapping reflow ranges by original offsets', () => {
    const ledger = new ReadingShareLedger();
    ledger.visit(visit(0, 4)); ledger.commit('a', ledger.pending(1, 'a'));
    ledger.visit(visit(2, 7)); ledger.visit(visit(0, 7));
    expect(ledger.pending(1, 'a').map((v) => v.text).join('')).toBe('戊己庚');
    ledger.commit('a', ledger.pending(1, 'a'));
    expect(ledger.pending(1, 'a')).toEqual([]);
  });
  it('keeps failed and later in-flight content pending until its own commit', () => {
    const ledger = new ReadingShareLedger(); ledger.visit(visit());
    const batch = ledger.pending(1, 'a');
    expect(ledger.pending(1, 'a')).toEqual(batch);
    ledger.visit(visit(4, 8)); ledger.commit('a', batch);
    expect(ledger.pending(1, 'a').map((v) => v.text).join('')).toBe('戊己庚辛');
  });
  it('isolates books, conversations and changed source revisions', () => {
    const ledger = new ReadingShareLedger(); ledger.visit(visit()); ledger.visit(visit(0, 4, 0, 2));
    ledger.commit('a', ledger.pending(1, 'a'));
    expect(ledger.pending(1, 'a')).toHaveLength(0);
    expect(ledger.pending(1, 'b')).toHaveLength(1);
    expect(ledger.pending(2, 'a')).toHaveLength(1);
    expect(readingSourceKey(1, 0, source)).not.toBe(readingSourceKey(1, 0, source + '新'));
  });
  it('restores pending and delivered ranges after a reload', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const first = new ReadingShareLedger(storage); first.visit(visit()); first.commit('a', first.pending(1, 'a')); first.visit(visit(4, 8));
    expect(new ReadingShareLedger(storage).pending(1, 'a').map((v) => v.text).join('')).toBe('戊己庚辛');
  });
  it('survives unavailable storage and subtracts multiple delivered intervals', () => {
    const ledger = new ReadingShareLedger({ getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
    ledger.visit(visit()); expect(ledger.pending(1, 'a')).toHaveLength(1);
    expect(subtractRanges({ start: 0, end: 10 }, [{ start: 2, end: 4 }, { start: 6, end: 9 }])).toEqual([
      { start: 0, end: 2 }, { start: 4, end: 6 }, { start: 9, end: 10 }
    ]);
  });
});
