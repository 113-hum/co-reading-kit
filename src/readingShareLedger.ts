import type { TextRange } from './readingPagination';

export type ReadingVisit = TextRange & {
  key: string; bookId: number; bookTitle: string; chapterIndex: number; chapterTitle: string; text: string;
};
type Snapshot = { visits: ReadingVisit[]; sent: Record<string, Record<string, TextRange[]>> };

export function readingSourceKey(bookId: number, chapterIndex: number, text: string): string {
  let a = 2166136261; let b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${bookId}:${chapterIndex}:${text.length}:${a >>> 0}:${b >>> 0}`;
}

export function subtractRanges(range: TextRange, covered: TextRange[]): TextRange[] {
  let result = [range];
  for (const item of covered) result = result.flatMap((part) => {
    if (item.end <= part.start || item.start >= part.end) return [part];
    return [
      ...(item.start > part.start ? [{ start: part.start, end: item.start }] : []),
      ...(item.end < part.end ? [{ start: item.end, end: part.end }] : [])
    ];
  });
  return result.filter((part) => part.end > part.start);
}

function mergeRanges(ranges: TextRange[]): TextRange[] {
  const result: TextRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = result[result.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else result.push({ start: range.start, end: range.end });
  }
  return result;
}

export class ReadingShareLedger {
  private state: Snapshot = { visits: [], sent: {} };
  constructor(private storage?: Pick<Storage, 'getItem' | 'setItem'>, private storageKey = 'reading-share-ranges-v1') {
    try {
      const raw = JSON.parse(storage?.getItem(storageKey) || 'null');
      if (raw && Array.isArray(raw.visits) && raw.sent && typeof raw.sent === 'object') {
        this.state.visits = raw.visits.filter((v: ReadingVisit) => typeof v.key === 'string'
          && typeof v.text === 'string' && Number.isInteger(v.start) && Number.isInteger(v.end)
          && v.start >= 0 && v.end > v.start && v.end - v.start === v.text.length);
        for (const [scope, entries] of Object.entries(raw.sent)) {
          if (!entries || typeof entries !== 'object') continue;
          this.state.sent[scope] = {};
          for (const [key, ranges] of Object.entries(entries)) {
            if (!Array.isArray(ranges)) continue;
            this.state.sent[scope][key] = ranges.filter((r: TextRange) => Number.isInteger(r.start) && Number.isInteger(r.end) && r.start >= 0 && r.end > r.start);
          }
        }
      }
    } catch { /* Storage is optional; memory tracking still works. */ }
  }
  private save() {
    try { this.storage?.setItem(this.storageKey, JSON.stringify(this.state)); } catch { /* Never block chat. */ }
  }
  visit(visit: ReadingVisit) {
    const covered = this.state.visits.filter((v) => v.key === visit.key);
    for (const part of subtractRanges(visit, covered)) {
      const text = visit.text.slice(part.start - visit.start, part.end - visit.start);
      const last = this.state.visits[this.state.visits.length - 1];
      if (last && last.key === visit.key && last.end === part.start) {
        last.end = part.end;
        last.text += text;
      } else this.state.visits.push({ ...visit, ...part, text });
    }
    this.save();
  }
  pending(bookId: number, scope: string): ReadingVisit[] {
    const sent = this.state.sent[scope] || {};
    return this.state.visits.filter((v) => v.bookId === bookId).flatMap((visit) =>
      subtractRanges(visit, sent[visit.key] || []).map((part) => ({
        ...visit, ...part, text: visit.text.slice(part.start - visit.start, part.end - visit.start)
      })));
  }
  commit(scope: string, delivered: ReadingVisit[]) {
    const sent = this.state.sent[scope] ||= {};
    for (const visit of delivered) sent[visit.key] = mergeRanges([...(sent[visit.key] || []), visit]);
    this.save();
  }
}

let ledger: ReadingShareLedger | undefined;
export function getReadingShareLedger() {
  if (!ledger) {
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch { /* SSR and unavailable storage. */ }
    ledger = new ReadingShareLedger(storage);
  }
  return ledger;
}
