import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import type { EpubContent } from '../types.js';
import { debug } from '../utils/logger.js';

/**
 * 生成 container.xml 内容
 */
function generateContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

/**
 * 创建 EPUB 文件
 */
export async function createEpub(outputPath: string, content: EpubContent): Promise<void> {
  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      const sizeKB = (archive.pointer() / 1024).toFixed(1);
      debug(`EPUB file size: ${sizeKB} KB`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(new Error(`Failed to pack EPUB: ${err.message}`));
    });

    archive.pipe(output);

    // 1. mimetype 必须是第一个文件，且不压缩
    archive.append('application/epub+zip', {
      name: 'mimetype',
      store: true, // 不压缩
    });

    // 2. META-INF/container.xml
    archive.append(generateContainerXml(), {
      name: 'META-INF/container.xml',
    });

    // 3. OEBPS/content.opf
    archive.append(content.opf, {
      name: 'OEBPS/content.opf',
    });

    // 4. OEBPS/toc.ncx
    archive.append(content.ncx, {
      name: 'OEBPS/toc.ncx',
    });

    // 5. OEBPS/nav.xhtml
    archive.append(content.nav, {
      name: 'OEBPS/nav.xhtml',
    });

    // 6. OEBPS/stylesheet.css
    archive.append(content.css, {
      name: 'OEBPS/stylesheet.css',
    });

    // 7. OEBPS/highlight.css
    archive.append(content.highlightCss, {
      name: 'OEBPS/highlight.css',
    });

    // 8. 章节文件
    for (const chapter of content.chapters) {
      archive.append(chapter.xhtml, {
        name: `OEBPS/chapters/${chapter.filename}`,
      });
      debug(`Packing chapter: ${chapter.filename}`);
    }

    // 9. 图片资源
    for (const image of content.images) {
      archive.append(image.data, {
        name: `OEBPS/${image.epubPath}`,
      });
      debug(`Packing image: ${image.filename}`);
    }

    archive.finalize();
  });
}
