import * as fs from 'fs';
import * as path from 'path';

/** 读取文件内容，返回字符串 */
export async function readFile(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, 'utf-8');
}

/** 读取文件为 Buffer */
export async function readFileBuffer(filePath: string): Promise<Buffer> {
  return fs.promises.readFile(filePath);
}

/** 检查文件/目录是否存在 */
export function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/** 确保目录存在 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

/** 解析相对于基础目录的路径 */
export function resolvePath(baseDir: string, relativePath: string): string {
  return path.resolve(baseDir, relativePath);
}

/** 获取文件的 MIME 类型（基于扩展名） */
export function getMediaType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.css': 'text/css',
    '.xhtml': 'application/xhtml+xml',
    '.html': 'application/xhtml+xml',
  };
  return types[ext] || 'application/octet-stream';
}

/** 递归扫描目录下所有指定扩展名的文件 */
export async function scanFiles(dir: string, extensions: string[]): Promise<string[]> {
  const results: string[] = [];

  async function scan(currentDir: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // 跳过隐藏目录和 node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scan(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  await scan(dir);
  return results.sort();
}
