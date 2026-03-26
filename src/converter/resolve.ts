import * as path from 'path';
import * as fs from 'fs';
import type { Chapter } from '../types.js';
import { debug, warn } from '../utils/logger.js';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'];

/**
 * 预处理章节内容，自动解析未定义的引用式图片
 *
 * 处理 ![][00-01] 这类引用式图片：
 * 1. 找到所有 ![...][ref-id] 的使用
 * 2. 找到已有的 [ref-id]: url 引用定义
 * 3. 对于缺失定义的引用，在 docs 目录中搜索匹配的图片文件
 * 4. 将找到的图片路径作为引用定义追加到内容末尾
 */
export function resolveImageRefs(chapter: Chapter, docsDir: string): string {
  if (!chapter.content) return chapter.content || '';

  let content = chapter.content;
  const chapterDir = chapter.path ? path.dirname(chapter.path) : '.';

  // 1. 收集所有引用式图片使用：![alt][ref-id] 或 ![][ref-id]
  const refUsageRegex = /!\[[^\]]*\]\[([^\]]+)\]/g;
  const usedRefs = new Set<string>();
  let match;
  while ((match = refUsageRegex.exec(content)) !== null) {
    usedRefs.add(match[1]);
  }

  if (usedRefs.size === 0) return content;

  // 2. 收集已定义的引用 [ref-id]: url
  const refDefRegex = /^\[([^\]]+)\]:\s*(\S+)/gm;
  const definedRefs = new Map<string, string>();
  while ((match = refDefRegex.exec(content)) !== null) {
    definedRefs.set(match[1], match[2]);
  }

  // 3. 找出未定义的引用
  const undefinedRefs: string[] = [];
  for (const refId of usedRefs) {
    if (!definedRefs.has(refId)) {
      undefinedRefs.push(refId);
    }
  }

  if (undefinedRefs.length === 0) return content;

  // 4. 在 docs 目录中搜索匹配的图片
  const appendLines: string[] = [];

  for (const refId of undefinedRefs) {
    const found = findImageFile(refId, docsDir, chapterDir);
    if (found) {
      // 计算相对于章节目录的路径
      const absChapterDir = path.resolve(docsDir, chapterDir);
      const relPath = path.relative(absChapterDir, found);
      appendLines.push(`[${refId}]: ${relPath}`);
      debug(`Auto-resolving image reference: [${refId}] → ${relPath}`);
    } else {
      warn(`Cannot find reference-style image: ![][${refId}]`);
    }
  }

  // 5. 追加引用定义到内容末尾
  if (appendLines.length > 0) {
    content = content + '\n\n' + appendLines.join('\n') + '\n';
  }

  return content;
}

/**
 * 在 docs 目录中搜索与 refId 匹配的图片文件
 * 搜索策略：
 * 1. 直接在章节同级目录查找 refId + 扩展名
 * 2. 在 docs 根目录常见图片目录中查找（images/, img/, assets/, media/）
 * 3. 递归搜索 docs 目录
 */
function findImageFile(refId: string, docsDir: string, chapterDir: string): string | null {
  const absDocsDir = path.resolve(docsDir);
  const absChapterDir = path.resolve(docsDir, chapterDir);

  // 常见图片目录
  const imageDirs = [
    absChapterDir,                           // 章节同级目录
    path.join(absDocsDir, 'images'),          // docs/images/
    path.join(absDocsDir, 'img'),             // docs/img/
    path.join(absDocsDir, 'assets'),          // docs/assets/
    path.join(absDocsDir, 'media'),           // docs/media/
    path.join(absDocsDir, '_media'),          // docs/_media/ (docsify 默认)
    path.join(absChapterDir, 'images'),       // chapter/images/
    path.join(absChapterDir, 'img'),          // chapter/img/
    absDocsDir,                              // docs 根目录
  ];

  // 在每个目录中尝试每种扩展名
  for (const dir of imageDirs) {
    if (!fs.existsSync(dir)) continue;

    for (const ext of IMAGE_EXTS) {
      const candidate = path.join(dir, refId + ext);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  // 如果 refId 已有扩展名，直接在各目录查找
  if (IMAGE_EXTS.some(ext => refId.endsWith(ext))) {
    for (const dir of imageDirs) {
      if (!fs.existsSync(dir)) continue;
      const candidate = path.join(dir, refId);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}
