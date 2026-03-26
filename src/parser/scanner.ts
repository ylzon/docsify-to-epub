import * as path from 'path';
import type { Chapter } from '../types.js';
import { scanFiles } from '../utils/fs.js';
import { debug } from '../utils/logger.js';

/**
 * 当不存在 _sidebar.md 时，扫描目录自动构建章节结构
 */
export async function scanForChapters(docsDir: string): Promise<Chapter[]> {
  const mdFiles = await scanFiles(docsDir, ['.md']);
  const chapters: Chapter[] = [];
  let index = 0;

  // README.md 作为第一章
  const readmePath = path.join(docsDir, 'README.md');
  const relFiles = mdFiles
    .map(f => path.relative(docsDir, f))
    .filter(f => !f.startsWith('_') && !f.startsWith('.'));

  // 将 README.md 放在最前面
  const sorted = relFiles.sort((a, b) => {
    if (a === 'README.md') return -1;
    if (b === 'README.md') return 1;
    return a.localeCompare(b);
  });

  for (const relPath of sorted) {
    const level = relPath.split(path.sep).length - 1;
    const basename = path.basename(relPath, '.md');
    const title = basename === 'README' ? '首页' : basename.replace(/[-_]/g, ' ');

    chapters.push({
      id: `chapter-${String(++index).padStart(3, '0')}`,
      title,
      path: relPath,
      level,
      children: [],
    });
  }

  debug(`Scanned ${chapters.length} Markdown files`);
  return chapters;
}
