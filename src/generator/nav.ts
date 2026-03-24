import type { ChapterContent } from '../types.js';

/**
 * 生成 EPUB 3 导航文档 (nav.xhtml)
 * 支持嵌套的子标题（h2/h3）
 */
export function generateNav(title: string, chapters: ChapterContent[]): string {
  const tocItems: string[] = [];

  for (const ch of chapters) {
    // 章节主条目
    tocItems.push(`      <li><a href="chapters/${ch.filename}">${escapeXml(ch.title)}</a>`);

    // 如果有子标题，生成嵌套列表
    if (ch.subHeadings && ch.subHeadings.length > 0) {
      tocItems.push('        <ol>');
      for (const sub of ch.subHeadings) {
        const indent = sub.level === 3 ? '            ' : '          ';
        tocItems.push(`${indent}<li><a href="chapters/${ch.filename}#${sub.anchor}">${escapeXml(sub.title)}</a></li>`);
      }
      tocItems.push('        </ol>');
    }

    tocItems.push('      </li>');
  }

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
${tocItems.join('\n')}
    </ol>
  </nav>
</body>
</html>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
