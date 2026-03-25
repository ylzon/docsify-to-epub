import type { TocEntry } from '../types.js';

/**
 * 生成 EPUB 3 导航文档 (nav.xhtml)
 * 支持从 sidebar 层级结构生成嵌套目录
 */
export function generateNav(title: string, tocTree: TocEntry[]): string {
  const tocHtml = renderNavList(tocTree, 3);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(title)} - 目录</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css" />
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
${tocHtml}
    </ol>
  </nav>
</body>
</html>`;
}

function renderNavList(entries: TocEntry[], indent: number): string {
  const pad = ' '.repeat(indent * 2);
  const lines: string[] = [];

  for (const entry of entries) {
    const link = entry.filename
      ? `<a href="chapters/${entry.filename}">${escapeXml(entry.title)}</a>`
      : `<span>${escapeXml(entry.title)}</span>`;

    if (entry.children.length > 0) {
      lines.push(`${pad}<li>`);
      lines.push(`${pad}  ${link}`);
      lines.push(`${pad}  <ol>`);
      lines.push(renderNavList(entry.children, indent + 2));
      lines.push(`${pad}  </ol>`);
      lines.push(`${pad}</li>`);
    } else {
      lines.push(`${pad}<li>${link}</li>`);
    }
  }

  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
