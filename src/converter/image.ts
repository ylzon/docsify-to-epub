import * as path from 'path';
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
        warn(`下载远程图片失败 (${response.status}): ${url} [第 ${attempt}/${maxRetries} 次]`);
        if (attempt < maxRetries) continue;
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || '';
      const ext = extFromUrl(url) || extFromContentType(contentType);
      return { data, ext };
    } catch (err) {
      warn(`下载远程图片失败: ${url} - ${err} [第 ${attempt}/${maxRetries} 次]`);
      if (attempt < maxRetries) continue;
      return null;
    }
  }
  return null;
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
  const total = imageRefs.length;

  for (let i = 0; i < imageRefs.length; i++) {
    const ref = imageRefs[i];
    onProgress?.(i + 1, total);
    if (ref.remote) {
      // 下载远程图片
      const result = await downloadImage(ref.src);
      if (!result) {
        error(`远程图片下载最终失败: ${ref.src} (来源: ${ref.chapterPath})`);
        continue;
      }

      const { data, ext } = result;
      const filename = `image-${String(++index).padStart(3, '0')}${ext}`;
      const mediaType = getMediaType(filename);

      const asset: ImageAsset = {
        id: `img-${String(index).padStart(3, '0')}`,
        originalPath: ref.src,
        epubPath: `images/${filename}`,
        filename,
        mediaType,
        data,
      };

      images.push(asset);
      imageMap.set(ref.src, `../images/${filename}`);
      debug(`下载远程图片: ${ref.src} → ${filename} (${(data.length / 1024).toFixed(1)} KB)`);
      continue;
    }

    // 本地图片
    const absolutePath = path.resolve(docsDir, ref.chapterDir, ref.src);

    if (!exists(absolutePath)) {
      warn(`图片文件不存在: ${ref.src} (解析路径: ${absolutePath})`);
      continue;
    }

    try {
      const data = await readFileBuffer(absolutePath);
      const ext = path.extname(ref.src).toLowerCase();
      const filename = `image-${String(++index).padStart(3, '0')}${ext}`;
      const mediaType = getMediaType(ref.src);

      // 规范化后的相对路径（相对于 docsDir）
      const normalizedKey = path.normalize(path.join(ref.chapterDir, ref.src));

      const asset: ImageAsset = {
        id: `img-${String(index).padStart(3, '0')}`,
        originalPath: normalizedKey,
        epubPath: `images/${filename}`,
        filename,
        mediaType,
        data,
      };

      images.push(asset);
      // key 用规范化路径，这样不同章节引用同一图片只嵌入一次
      imageMap.set(normalizedKey, `../images/${filename}`);
      debug(`加载图片: ${normalizedKey} → ${filename} (${(data.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      warn(`加载图片失败: ${ref.src} - ${err}`);
    }
  }

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
