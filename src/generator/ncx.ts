import type { TocEntry } from '../types.js';

/**
 * 生成 toc.ncx 文件内容（EPUB 2 向后兼容导航）
 * 支持从 sidebar 层级结构生成嵌套导航点
 */
export function generateNcx(
  bookId: string,
  title: string,
  tocTree: TocEntry[]
): string {
  let playOrder = 0;

  function renderNavPoints(entries: TocEntry[], indent: number): string {
    const pad = ' '.repeat(indent * 2);
    const points: string[] = [];

    for (const entry of entries) {
      // NCX 中 content src 不能为空，跳过无文件名的条目
      if (!entry.filename) continue;

      playOrder++;
      const thisOrder = playOrder;
      const childXml = entry.children.length > 0
        ? '\n' + renderNavPoints(entry.children, indent + 1)
        : '';

      points.push(
`${pad}<navPoint id="navpoint-${thisOrder}" playOrder="${thisOrder}">
${pad}  <navLabel>
${pad}    <text>${escapeXml(entry.title)}</text>
${pad}  </navLabel>
${pad}  <content src="chapters/${entry.filename}"/>${childXml}
${pad}</navPoint>`
      );
    }

    return points.join('\n');
  }

  function calcMaxDepth(entries: TocEntry[], depth: number): number {
    if (entries.length === 0) return depth;
    return Math.max(...entries.map(e => calcMaxDepth(e.children, depth + 1)));
  }
  const depth = calcMaxDepth(tocTree, 0) || 1;

  const navPoints = renderNavPoints(tocTree, 2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${bookId}"/>
    <meta name="dtb:depth" content="${depth}"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(title)}</text>
  </docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
