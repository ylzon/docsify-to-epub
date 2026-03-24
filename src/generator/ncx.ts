import type { ChapterContent } from '../types.js';

/**
 * 生成 toc.ncx 文件内容（EPUB 2 向后兼容导航）
 * 支持嵌套的子标题
 */
export function generateNcx(
  bookId: string,
  title: string,
  chapters: ChapterContent[]
): string {
  let playOrder = 0;

  const navPoints = chapters.map((chapter) => {
    playOrder++;
    const chapterOrder = playOrder;

    let subNavPoints = '';
    if (chapter.subHeadings && chapter.subHeadings.length > 0) {
      subNavPoints = chapter.subHeadings.map((sub) => {
        playOrder++;
        return `      <navPoint id="navpoint-${playOrder}" playOrder="${playOrder}">
        <navLabel>
          <text>${escapeXml(sub.title)}</text>
        </navLabel>
        <content src="chapters/${chapter.filename}#${sub.anchor}"/>
      </navPoint>`;
      }).join('\n');
    }

    return `    <navPoint id="navpoint-${chapterOrder}" playOrder="${chapterOrder}">
      <navLabel>
        <text>${escapeXml(chapter.title)}</text>
      </navLabel>
      <content src="chapters/${chapter.filename}"/>
${subNavPoints}
    </navPoint>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${bookId}"/>
    <meta name="dtb:depth" content="2"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(title)}</text>
  </docTitle>
  <navMap>
${navPoints.join('\n')}
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
