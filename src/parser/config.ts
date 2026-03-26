import type { DocsifyConfig } from '../types.js';
import { readFile, exists } from '../utils/fs.js';
import { debug } from '../utils/logger.js';
import * as path from 'path';

/**
 * 从 index.html 中提取 Docsify 配置
 */
export async function extractConfig(docsDir: string): Promise<DocsifyConfig> {
  const indexPath = path.join(docsDir, 'index.html');

  if (!exists(indexPath)) {
    debug('index.html not found, using default configuration');
    return {};
  }

  const html = await readFile(indexPath);
  const config: DocsifyConfig = {};

  // 提取 window.$docsify 配置块
  const configMatch = html.match(/window\.\$docsify\s*=\s*\{([\s\S]*?)\}/);
  if (!configMatch) {
    debug('window.$docsify configuration not found');
    return config;
  }

  const configStr = configMatch[1];

  // 提取 name
  const nameMatch = configStr.match(/name\s*:\s*['"]([^'"]+)['"]/);
  if (nameMatch) config.name = nameMatch[1];

  // 提取 basePath
  const basePathMatch = configStr.match(/basePath\s*:\s*['"]([^'"]+)['"]/);
  if (basePathMatch) config.basePath = basePathMatch[1];

  // 提取 loadSidebar
  const sidebarMatch = configStr.match(/loadSidebar\s*:\s*(true|false|['"][^'"]+['"])/);
  if (sidebarMatch) {
    const val = sidebarMatch[1];
    if (val === 'true') config.loadSidebar = true;
    else if (val === 'false') config.loadSidebar = false;
    else config.loadSidebar = val.replace(/['"]/g, '');
  }

  // 提取 coverpage
  const coverMatch = configStr.match(/coverpage\s*:\s*(true|false|['"][^'"]+['"])/);
  if (coverMatch) {
    const val = coverMatch[1];
    if (val === 'true') config.coverpage = true;
    else if (val === 'false') config.coverpage = false;
    else config.coverpage = val.replace(/['"]/g, '');
  }

  // 提取 subMaxLevel
  const subMaxMatch = configStr.match(/subMaxLevel\s*:\s*(\d+)/);
  if (subMaxMatch) config.subMaxLevel = parseInt(subMaxMatch[1], 10);

  // 提取 <title> 作为备用标题
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) config.htmlTitle = titleMatch[1].trim();

  debug(`Extracted Docsify configuration: ${JSON.stringify(config)}`);
  return config;
}

/**
 * 从 index.html 中提取引用的 CSS 链接
 */
export function extractCssLinks(html: string): string[] {
  const links: string[] = [];
  const regex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    links.push(match[1]);
  }
  // 也匹配 href 在 rel 前面的情况
  const regex2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*>/gi;
  while ((match = regex2.exec(html)) !== null) {
    if (!links.includes(match[1])) {
      links.push(match[1]);
    }
  }
  return links;
}
