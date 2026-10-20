import './demo.css';
import { measureReadingPages, pageAtOffset, type TextRange } from './readingPagination';
import { ReadingShareLedger, readingSourceKey } from './readingShareLedger';
import { captureReadingVisits } from './readingCapture';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<header><div><h1>一起读</h1><small>Co-reading Kit · 自动分页与增量分享</small></div><button id="import">导入 TXT</button><input id="file" type="file" accept=".txt,text/plain" hidden></header>
<main><section class="reader" aria-label="阅读器"><div class="tools">
<label class="sr-only" for="chapter">章节</label><select id="chapter"><option value="0">第一章 · 花园来信</option><option value="1">第二章 · 晚风的回信</option></select>
<button id="smaller" aria-label="缩小字体">A−</button><button id="larger" aria-label="放大字体">A＋</button>
</div><article class="paper" style="font-size:18px"><p></p></article>
<nav class="nav" aria-label="翻页"><button id="prev">上一页</button><span id="position"></span><button id="next">下一页</button></nav></section>
<aside class="share"><h2>让共读跟上你的进度</h2><p class="muted">连续翻几页再分享，也能把没发过的内容一起带上。这里仅模拟本地发送。</p>
<label for="scope">聊天范围</label> <select id="scope"><option value="demo-a">对话 A</option><option value="demo-b">对话 B</option></select>
<p id="pending"></p><label class="sr-only" for="message">想聊的话</label><textarea id="message" placeholder="读到这里，你想说些什么？"></textarea>
<p><label><input id="fail" type="checkbox"> 模拟发送失败，保留待分享内容</label></p>
<button id="send">分享已读内容（本地模拟）</button><div id="status" class="status" role="status" aria-live="polite"></div>
<details><summary>查看本次原文与书页图片</summary><pre id="payload"></pre><div class="preview" id="preview"></div></details>
</aside></main>`;

function element<T extends HTMLElement>(id: string) { return document.getElementById(id) as T; }
const paragraph = document.querySelector<HTMLElement>('.paper p')!;
const paper = document.querySelector<HTMLElement>('.paper')!;
const chapterSelect = element<HTMLSelectElement>('chapter');
const scopeSelect = element<HTMLSelectElement>('scope');
const status = element<HTMLDivElement>('status');
const send = element<HTMLButtonElement>('send');
const fileInput = element<HTMLInputElement>('file');
const message = element<HTMLTextAreaElement>('message');
const title = ['第一章 · 花园来信', '第二章 · 晚风的回信'];
let chapters = [
  Array.from({ length: 75 }, (_, i) => `第${i + 1}段。清晨，她推开花园的木门。窗台上的书被风翻开了一页，纸上还夹着昨天拾来的花瓣。她把椅子搬到阳光里，等朋友坐下，一起读完这个小小的故事。🌸\n\n`).join(''),
  Array.from({ length: 65 }, (_, i) => `第${i + 1}段。晚风经过长廊，带来一封没有署名的回信。信里写着：不用赶着读完，我们可以在喜欢的一句停留。于是他们泡了一壶茶，继续聊起白天读过的那几页。\n\n`).join('')
];
let bookId = 1;
let bookTitle = '花园来信';
let pages: TextRange[] = [{ start: 0, end: 0 }];
let index = 0; let anchor = 0; let fontSize = 18;
let storage: Storage | undefined;
try { storage = window.sessionStorage; } catch { /* In-memory mode is usable. */ }
const ledger = new ReadingShareLedger(storage, 'co-reading-kit-demo-v1');
const urls: string[] = [];
const source = () => chapters[Number(chapterSelect.value)] || '';

function updatePending() {
  const pending = ledger.pending(bookId, scopeSelect.value);
  const chars = pending.reduce((sum, part) => sum + Array.from(part.text).length, 0);
  element('pending').textContent = chars ? `待分享：${chars} 字，来自 ${new Set(pending.map(p => p.chapterIndex)).size} 个章节。` : '已读内容已经分享，继续翻页后再来聊。';
}
function showPage() {
  const text = source(); const range = pages[index];
  paragraph.textContent = text.slice(range.start, range.end);
  element('position').textContent = `第 ${index + 1} / ${pages.length} 页 · ${fontSize}px`;
  element<HTMLButtonElement>('prev').disabled = index === 0;
  element<HTMLButtonElement>('next').disabled = index === pages.length - 1;
  if (range.end > range.start) ledger.visit({
    key: readingSourceKey(bookId, Number(chapterSelect.value), text), bookId, bookTitle,
    chapterIndex: Number(chapterSelect.value), chapterTitle: title[Number(chapterSelect.value)],
    ...range, text: paragraph.textContent || ''
  });
  updatePending();
}
function reflow() {
  if (!paragraph.clientWidth || !paragraph.clientHeight) return;
  try {
    pages = measureReadingPages(source(), paragraph);
    index = pageAtOffset(pages, anchor);
    showPage();
  } catch (error) { status.className = 'status error'; status.textContent = String(error); }
}
for (const [id, direction] of [['prev', -1], ['next', 1]] as const) element(id).onclick = () => {
  index = Math.min(pages.length - 1, Math.max(0, index + direction)); anchor = pages[index].start; showPage();
};
for (const [id, direction] of [['smaller', -1], ['larger', 1]] as const) element(id).onclick = () => {
  fontSize = Math.min(30, Math.max(14, fontSize + direction)); paper.style.fontSize = `${fontSize}px`; reflow();
};
chapterSelect.onchange = () => { anchor = 0; reflow(); };
scopeSelect.onchange = updatePending;
const observer = new ResizeObserver(reflow); observer.observe(paragraph);
document.fonts.addEventListener('loadingdone', reflow);
void document.fonts.ready.then(reflow);
element('import').onclick = () => fileInput.click();
fileInput.onchange = async () => {
  const file = fileInput.files?.[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { status.textContent = '示例支持 2 MB 以内的 TXT，请先拆分。'; fileInput.value = ''; return; }
  const text = await file.text();
  if (!text.trim()) { status.textContent = '这份文件没有可阅读的文字。'; fileInput.value = ''; return; }
  bookId = 2; bookTitle = file.name.replace(/\.txt$/i, ''); chapters = [text]; title.splice(0, title.length, bookTitle);
  chapterSelect.replaceChildren(new Option(bookTitle, '0')); anchor = 0; reflow(); fileInput.value = '';
};
send.onclick = async () => {
  const scope = scopeSelect.value;
  const pending = ledger.pending(bookId, scope);
  const simulateFailure = element<HTMLInputElement>('fail').checked;
  const userMessage = message.value;
  if (!pending.length) { status.className = 'status'; status.textContent = '当前没有新的原文；真实接入时仍可发送你的聊天消息。'; return; }
  send.disabled = true; status.className = 'status'; status.textContent = '正在准备这批已读内容…';
  try {
    const images = await captureReadingVisits(pending);
    await new Promise(resolve => setTimeout(resolve, 500));
    if (simulateFailure) throw new Error('模拟发送失败。待分享内容已保留，可以重试。');
    ledger.commit(scope, pending);
    element('payload').textContent = `本地模拟请求\n${userMessage}\n\n` + pending.map(v => `【${v.chapterTitle} · ${v.start}–${v.end}】\n${v.text}`).join('\n\n');
    urls.splice(0).forEach(url => URL.revokeObjectURL(url));
    const preview = element('preview'); preview.replaceChildren();
    images.forEach((blob, i) => { const img = new Image(); const url = URL.createObjectURL(blob); urls.push(url); img.src = url; img.alt = `本次分享书页 ${i + 1}`; preview.appendChild(img); });
    status.textContent = `本地模拟成功：${images.length} 张书页图片。没有向外部服务发送数据。`;
    if (message.value === userMessage) message.value = '';
  } catch (error) { status.className = 'status error'; status.textContent = error instanceof Error ? error.message : '发送失败，内容已保留。'; }
  finally { send.disabled = false; updatePending(); }
};
reflow();
