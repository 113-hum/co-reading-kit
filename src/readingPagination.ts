export type TextRange = { start: number; end: number };

// Keep offsets in the unchanged source text, including whitespace and surrogate pairs.
export function paginateMeasuredText(text: string, fits: (value: string) => boolean): TextRange[] {
  if (!text) return [{ start: 0, end: 0 }];
  const points = [0];
  for (const character of text) points.push(points[points.length - 1] + character.length);
  const pages: TextRange[] = [];
  let start = 0;
  while (start < points.length - 1) {
    let low = start + 1;
    let high = points.length - 1;
    let best = start;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (fits(text.slice(points[start], points[mid]))) { best = mid; low = mid + 1; }
      else high = mid - 1;
    }
    if (best === start) throw new Error('阅读区域太小，请收起键盘或调整窗口后重试。');
    pages.push({ start: points[start], end: points[best] });
    start = best;
  }
  return pages;
}

export function pageAtOffset(pages: TextRange[], offset: number): number {
  const index = pages.findIndex((page) => offset >= page.start && offset < page.end);
  return index >= 0 ? index : Math.max(0, pages.length - 1);
}

export function measureReadingPages(text: string, paragraph: HTMLElement): TextRange[] {
  const style = getComputedStyle(paragraph);
  const probe = paragraph.cloneNode(false) as HTMLElement;
  for (const property of Array.from(style)) probe.style.setProperty(property, style.getPropertyValue(property));
  Object.assign(probe.style, {
    position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden',
    width: `${paragraph.clientWidth}px`, height: `${paragraph.clientHeight}px`,
    margin: '0', padding: '0', border: '0', boxSizing: 'border-box',
    transform: 'none', animation: 'none', transition: 'none', pointerEvents: 'none'
  });
  probe.removeAttribute('id');
  probe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(probe);
  try {
    return paginateMeasuredText(text, (value) => {
      probe.textContent = value;
      return probe.scrollWidth <= probe.clientWidth + 1 && probe.scrollHeight <= probe.clientHeight + 1;
    });
  } finally { probe.remove(); }
}
