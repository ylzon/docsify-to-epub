import type { Chapter, TocEntry } from '../types.js';

/**
 * 去除字符串中的 HTML 标签，仅保留文本内容
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * 解析 _sidebar.md 文件内容，生成章节树结构
 */
export function parseSidebar(content: string, basePath: string = ''): Chapter[] {
  const lines = content.split('\n');
  const chapters: Chapter[] = [];
  const stack: { level: number; children: Chapter[] }[] = [{ level: -1, children: chapters }];
  let chapterIndex = 0;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed) continue;

    // 计算缩进层级（每2个空格或一个 tab 为一级）
    const indent = line.length - line.trimStart().length;
    const level = Math.floor(indent / 2);

    // 匹配列表项：* [title](path) 或 - [title](path)
    // 使用 (.+) 来匹配路径，以支持路径中包含括号的情况，直到行尾的 )
    const linkMatch = trimmed.match(/^[\s]*[*\-+]\s+\[(.*?)\]\((.+)\)$/);
    // 匹配纯文本列表项：* title
    const textMatch = trimmed.match(/^[\s]*[*\-+]\s+(.+)/);

    if (linkMatch) {
      const title = stripHtml(linkMatch[1]);
      let path = decodeURIComponent(linkMatch[2]);

      // 处理路径：/ → README.md
      if (path === '/' || path === '') {
        path = 'README.md';
      }
      // 移除开头的 /
      if (path.startsWith('/')) {
        path = path.slice(1);
      }
      // 补全 .md 扩展名
      if (!path.endsWith('.md') && !path.includes('.')) {
        path = path + '.md';
      }

      // 拼接基础路径
      const fullPath = basePath ? `${basePath}/${path}` : path;

      const chapter: Chapter = {
        id: `chapter-${String(++chapterIndex).padStart(3, '0')}`,
        title,
        path: fullPath,
        level,
        children: [],
      };

      // 回溯 stack 找到正确的父级
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      stack[stack.length - 1].children.push(chapter);
      stack.push({ level, children: chapter.children });
    } else if (textMatch && !linkMatch) {
      // 纯文本分组标题（无链接）
      const title = stripHtml(textMatch[1].trim());
      const chapter: Chapter = {
        id: `chapter-${String(++chapterIndex).padStart(3, '0')}`,
        title,
        path: '',
        level,
        children: [],
      };

      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      stack[stack.length - 1].children.push(chapter);
      stack.push({ level, children: chapter.children });
    }
  }

  return chapters;
}

/**
 * 将章节树扁平化为有序列表
 */
export function flattenChapters(chapters: Chapter[]): Chapter[] {
  const result: Chapter[] = [];

  function walk(list: Chapter[]): void {
    for (const ch of list) {
      result.push(ch);
      if (ch.children.length > 0) {
        walk(ch.children);
      }
    }
  }

  walk(chapters);
  return result;
}

/**
 * 从章节树构建层级目录结构
 * @param chapters 解析 sidebar 得到的层级章节树
 * @param filenameMap 章节 ID → 文件名 的映射（如 "chapter-001" → "chapter-001.xhtml"）
 */
export function buildTocTree(
  chapters: Chapter[],
  filenameMap: Map<string, string>
): TocEntry[] {
  function findFirstFilename(entries: TocEntry[]): string {
    for (const entry of entries) {
      if (entry.filename) return entry.filename;
      const found = findFirstFilename(entry.children);
      if (found) return found;
    }
    return '';
  }

  function convert(ch: Chapter): TocEntry {
    const children = ch.children.map(convert);

    // 有路径的章节用自身文件名，无路径的分组标题用第一个后代的文件名
    let filename = filenameMap.get(ch.id) || '';
    if (!filename) {
      filename = findFirstFilename(children);
    }

    return { title: ch.title, filename, children };
  }

  return chapters.map(convert);
}
