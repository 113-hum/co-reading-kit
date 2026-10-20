# Co-reading Kit · 一起读

一个可独立运行的 AI 共读示例，包含从 Polaris 共读功能提取的分页、阅读范围记录和图片生成模块。

- 根据真实字体、行高、书页尺寸和栏数重新分页；放大字体，每页内容减少。
- 保留原文偏移，重排时尽量留在正在读的位置。
- 累积实际显示过的内容；跳过的页不加入待分享记录。
- 按书籍、章节、原文版本和聊天范围去重，发送成功后再确认。
- 按内容生成完整书页图片；图片过长时分张，避免截掉末尾。

## 运行

需要 Node.js 22.13 或更新版本。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址。示例完全在浏览器内运行，使用原创示例文字，也可导入本地 TXT；“分享”只模拟本地发送，不会连接模型或服务器。

```sh
npm test
npm run build
npm run preview
```

## 模块

| 文件 | 用途 |
| --- | --- |
| `src/readingPagination.ts` | 根据 DOM 真实排版测量分页，并按原文偏移定位 |
| `src/readingShareLedger.ts` | 累积阅读范围、差集去重、发送快照确认、可注入存储 |
| `src/readingCapture.ts` | 将待分享内容绘制为不会裁字的图片 |
| `src/demo.ts` | 独立阅读器和本地发送模拟 |

## 接入真实聊天

```ts
const pending = ledger.pending(bookId, conversationId);
const images = await captureReadingVisits(pending);
// 必须提交这份快照对应的全部原文和图片。
await yourChatTransport({ text: pending.map(v => v.text).join('\n'), images });
ledger.commit(conversationId, pending);
```

只有确认这批内容已经被聊天链路接受后才 `commit`。生成图片、保存附件或发送失败时不确认；发送期间继续翻页，也只确认准备时的那批内容。生产环境还应在发送过程中防止重复提交。

`measureReadingPages()` 的段落元素必须已布局，具有确定宽高；它支持 CSS 多栏，并使用一个不可见副本测量。字体加载完成、字号变化、容器 resize 时重新调用，再用 `pageAtOffset()` 恢复位置。极小区域放不下一个字时会报错，请提示调整窗口。

默认示例使用当前标签页的 `sessionStorage`。刷新和关闭/重开阅读面板时记录仍保留；关闭标签页后不保证保留。真实应用可以向 `ReadingShareLedger` 注入自己的存储，按账户隔离并处理配额、登出清理和数据保留策略。存储不可用时退回内存，不阻断聊天。

聊天 ID 应稳定且互相隔离，新聊天应在创建成功后使用其实际 ID 确认。原文修订后会形成新的版本范围，不沿用旧内容的确认记录。示例不会把数据库、聊天历史、密钥、服务器配置或用户书籍打包进仓库。

这是一份通用模块与示例，不包含 Polaris 的服务器、完整书架 API、模型连接、EPUB/PDF/DOCX 导入器或专属背景素材。

## 授权

沿用来源项目的 **AGPL-3.0-only**，详见 [LICENSE](LICENSE)。示例文字为本仓库原创样例。第三方依赖遵循各自许可证。
