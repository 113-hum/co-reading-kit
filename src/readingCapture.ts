import type { ReadingVisit } from './readingShareLedger';

// Render every line. A new image starts before the fixed canvas would clip text.
export async function captureReadingVisits(visits: ReadingVisit[]): Promise<Blob[]> {
  const images: Blob[] = [];
  for (const visit of visits) {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('共读图片生成失败，请重试。');
    context.font = '25px serif';
    const lines: string[] = [];
    for (const paragraph of visit.text.split('\n')) {
      let line = '';
      for (const character of paragraph) {
        if (line && context.measureText(line + character).width > 764) { lines.push(line); line = ''; }
        line += character;
      }
      lines.push(line);
    }
    for (let start = 0; start < lines.length; start += 36) {
      const batch = lines.slice(start, start + 36);
      canvas.height = 220 + batch.length * 42;
      context.fillStyle = '#fffdf8'; context.fillRect(0, 0, 900, canvas.height);
      context.fillStyle = '#7b5364'; context.font = '600 28px serif';
      context.fillText(visit.bookTitle, 68, 60, 764);
      context.font = '22px serif'; context.fillText(visit.chapterTitle, 68, 104, 764);
      context.fillStyle = '#4f4148'; context.font = '25px serif';
      batch.forEach((line, index) => context.fillText(line, 68, 170 + index * 42));
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) throw new Error('共读图片生成失败，请重试。');
      images.push(blob);
    }
  }
  return images;
}
