import * as path from 'path';
import sharp from 'sharp';
import type { Chapter, ImageAsset } from '../types.js';
import { readFileBuffer, exists, getMediaType } from '../utils/fs.js';
import { debug, warn, error } from '../utils/logger.js';

export interface ImageRef {
  /** 原始引用路径（Markdown 中写的） */
  src: string;
  /** 章节文件所在目录（相对于 docsDir） */
  chapterDir: string;
  /** 是否为远程图片（http/https） */
  remote: boolean;
  /** 来源章节的 Markdown 路径 */
  chapterPath: string;
}

/**
 * 从章节内容中收集所有图片引用，同时记录来源章节的目录
 */
export function collectImageRefs(chapters: Chapter[]): ImageRef[] {
  const seen = new Set<string>();
  const refs: ImageRef[] = [];
  // 内联图片: ![alt](path)
  const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  // HTML img 标签: <img src="path">
  const htmlImgRegex = /src=["']([^"']+)["']/g;
  // Markdown 引用式链接定义: [ref-id]: path/to/image.png
  const refDefRegex = /^\[([^\]]+)\]:\s*(\S+)/gm;
  // 图片文件扩展名
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];

  for (const chapter of chapters) {
    if (!chapter.content) continue;

    const chapterDir = chapter.path ? path.dirname(chapter.path) : '';

    const addRef = (src: string) => {
      if (src.startsWith('data:')) return;
      if (src.startsWith('http://') || src.startsWith('https://')) {
        if (!seen.has(src)) {
          seen.add(src);
          refs.push({ src, chapterDir, remote: true, chapterPath: chapter.path || '' });
        }
        return;
      }
      const resolved = path.normalize(path.join(chapterDir, src));
      if (!seen.has(resolved)) {
        seen.add(resolved);
        refs.push({ src, chapterDir, remote: false, chapterPath: chapter.path || '' });
      }
    };

    let match;

    // 1. 内联图片 ![alt](path)
    while ((match = imgRegex.exec(chapter.content)) !== null) {
      const src = match[1].split(' ')[0]; // 移除 title 部分
      addRef(src);
    }

    // 2. HTML img 标签
    while ((match = htmlImgRegex.exec(chapter.content)) !== null) {
      addRef(match[1]);
    }

    // 3. 引用式链接定义 [ref-id]: path — 只收集图片扩展名的
    while ((match = refDefRegex.exec(chapter.content)) !== null) {
      const refPath = match[2];
      const ext = path.extname(refPath).toLowerCase();
      if (imageExts.includes(ext)) {
        addRef(refPath);
      }
    }
  }

  return refs;
}

/**
 * 从 Content-Type 推断图片扩展名
 */
function extFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/x-icon': '.ico',
  };
  return map[contentType.split(';')[0].trim()] || '.png';
}

/**
 * 从 URL 中提取扩展名，若无法识别则返回空字符串
 */
function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];
    return imageExts.includes(ext) ? ext : '';
  } catch {
    return '';
  }
}

/**
 * 下载远程图片
 */
async function downloadImage(url: string, maxRetries: number = 3): Promise<{ data: Buffer; ext: string } | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        warn(`Failed to download remote image (${response.status}): ${url} [${attempt}/${maxRetries}]`);
        if (attempt < maxRetries) continue;
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || '';
      const ext = extFromUrl(url) || extFromContentType(contentType);
      return { data, ext };
    } catch (err) {
      warn(`Failed to download remote image: ${url} - ${err} [${attempt}/${maxRetries}]`);
      if (attempt < maxRetries) continue;
      return null;
    }
  }
  return null;
}

/**
 * 优化图片（大于 150KB 时压缩，SVG 转 PNG）
 */
async function optimizeImage(data: Buffer, ext: string, mediaType: string): Promise<{ data: Buffer; ext: string; mediaType: string }> {
  let newExt = ext;
  let newMediaType = mediaType;

  try {
    let s = sharp(data);
    let metadata = await s.metadata();

    const isSvg = metadata.format === 'svg' || ext === '.svg' || mediaType === 'image/svg+xml';
    let currentBuffer = await s.toBuffer();

    if (isSvg) {
      s = sharp(await s.png().toBuffer());
      newExt = '.png';
      newMediaType = 'image/png';
      metadata = await s.metadata();
    } else {
      if (currentBuffer.length > 150 * 1024) {
        if (metadata.format === 'jpeg' || newExt === '.jpg' || newExt === '.jpeg') {
          currentBuffer = await s.jpeg({ quality: 75 }).toBuffer();
        } else if (metadata.format === 'png' || newExt === '.png') {
          currentBuffer = await s.png({ quality: 75, compressionLevel: 9 }).toBuffer();
        } else if (metadata.format === 'webp' || newExt === '.webp') {
          currentBuffer = await s.webp({ quality: 75 }).toBuffer();
        }
      }
    }

    return { data: currentBuffer, ext: newExt, mediaType: newMediaType };
  } catch (err) {
    return { data, ext, mediaType };
  }
}

/**
 * 加载并处理图片资源
 * imageMap 的 key 是 "chapterDir + \0 + src" 的组合（用于精确匹配）
 */
export async function loadImages(
  imageRefs: ImageRef[],
  docsDir: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ images: ImageAsset[]; imageMap: Map<string, string> }> {
  const images: ImageAsset[] = [];
  const imageMap = new Map<string, string>();
  let index = 0;
  let completedCount = 0;
  const total = imageRefs.length;

  const concurrencyLimit = 5;
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < imageRefs.length; i++) {
    const ref = imageRefs[i];

    const task = (async () => {
      try {
        if (ref.remote) {
          // 下载远程图片
          const result = await downloadImage(ref.src);
          if (!result) {
            error(`Remote image download completely failed: ${ref.src} (Source: ${ref.chapterPath})`);
            return;
          }

          const { data: rawData, ext: rawExt } = result;
          const rawMediaType = getMediaType(`dummy${rawExt || '.png'}`);

          const { data, ext, mediaType } = await optimizeImage(rawData, rawExt, rawMediaType);

          const currentIndex = ++index;
          const filename = `image-${String(currentIndex).padStart(3, '0')}${ext}`;

          const asset: ImageAsset = {
            id: `img-${String(currentIndex).padStart(3, '0')}`,
            originalPath: ref.src,
            epubPath: `images/${filename}`,
            filename,
            mediaType,
            data,
          };

          images.push(asset);
          imageMap.set(ref.src, `../images/${filename}`);
          debug(`Downloading image: ${ref.src} → ${filename} (${(data.length / 1024).toFixed(1)} KB)`);
          return;
        }

        // 本地图片
        const absolutePath = path.resolve(docsDir, ref.chapterDir, ref.src);

        if (!exists(absolutePath)) {
          warn(`Image file not found: ${ref.src} (Resolved path: ${absolutePath})`);
          return;
        }

        const rawData = await readFileBuffer(absolutePath);
        const rawExt = path.extname(ref.src).toLowerCase();
        const rawMediaType = getMediaType(ref.src);

        const { data, ext, mediaType } = await optimizeImage(rawData, rawExt, rawMediaType);

        const currentIndex = ++index;
        const filename = `image-${String(currentIndex).padStart(3, '0')}${ext}`;

        // 规范化后的相对路径（相对于 docsDir）
        const normalizedKey = path.normalize(path.join(ref.chapterDir, ref.src));

        const asset: ImageAsset = {
          id: `img-${String(currentIndex).padStart(3, '0')}`,
          originalPath: normalizedKey,
          epubPath: `images/${filename}`,
          filename,
          mediaType,
          data,
        };

        images.push(asset);
        // key 用规范化路径，这样不同章节引用同一图片只嵌入一次
        imageMap.set(normalizedKey, `../images/${filename}`);
        debug(`Loading image: ${normalizedKey} → ${filename} (${(data.length / 1024).toFixed(1)} KB)`);
      } catch (err) {
        warn(`Failed to process image: ${ref.src} - ${err}`);
      } finally {
        completedCount++;
        onProgress?.(completedCount, total);
      }
    })();

    const p = task.then(() => {
      executing.delete(p);
    });
    executing.add(p);

    if (executing.size >= concurrencyLimit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);

  return { images, imageMap };
}

/**
 * 构建章节专用的 imageMap（将原始 src 映射为 EPUB 路径）
 */
export function buildChapterImageMap(
  chapterPath: string,
  globalImageMap: Map<string, string>
): Map<string, string> {
  const chapterDir = chapterPath ? path.dirname(chapterPath) : '';
  const localMap = new Map<string, string>();

  for (const [normalizedKey, epubPath] of globalImageMap) {
    // 尝试反推出从 chapterDir 出发的相对路径
    // 遍历所有全局图片，看哪些能匹配
    localMap.set(normalizedKey, epubPath);
  }

  return localMap;
}
