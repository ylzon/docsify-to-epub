import type { BookMetadata, ChapterContent, ImageAsset } from '../types.js';

/**
 * 生成 content.opf 文件内容
 */
export function generateOpf(
  metadata: BookMetadata,
  chapters: ChapterContent[],
  images: ImageAsset[],
  hasHighlightCss: boolean = true
): string {
  const manifestItems: string[] = [];
  const spineItems: string[] = [];

  // 导航文档
  manifestItems.push(
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
  );
  manifestItems.push(
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'
  );

  // 样式表
  manifestItems.push(
    '    <item id="stylesheet" href="stylesheet.css" media-type="text/css"/>'
  );
  if (hasHighlightCss) {
    manifestItems.push(
      '    <item id="highlight-css" href="highlight.css" media-type="text/css"/>'
    );
  }

  // 章节
  for (const chapter of chapters) {
    manifestItems.push(
      `    <item id="${chapter.id}" href="chapters/${chapter.filename}" media-type="application/xhtml+xml"/>`
    );
    spineItems.push(`    <itemref idref="${chapter.id}"/>`);
  }

  // 图片
  for (const image of images) {
    const props = image.mediaType === 'image/svg+xml' ? ' properties="svg"' : '';
    manifestItems.push(
      `    <item id="${image.id}" href="${image.epubPath}" media-type="${image.mediaType}"${props}/>`
    );
  }

  // 封面图片
  const coverMeta = metadata.cover
    ? `\n    <meta name="cover" content="cover-image"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:${metadata.identifier}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:creator>${escapeXml(metadata.author)}</dc:creator>
    <dc:date>${metadata.date}</dc:date>
    <meta property="dcterms:modified">${metadata.date}</meta>${coverMeta}
    ${metadata.publisher ? `<dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>` : ''}
    ${metadata.description ? `<dc:description>${escapeXml(metadata.description)}</dc:description>` : ''}
  </metadata>
  <manifest>
${manifestItems.join('\n')}
  </manifest>
  <spine toc="ncx">
${spineItems.join('\n')}
  </spine>
</package>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
