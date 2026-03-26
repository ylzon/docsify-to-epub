import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { readFile, exists } from '../utils/fs.js';
import { extractCssLinks } from '../parser/config.js';
import { debug, warn, info, error } from '../utils/logger.js';

/**
 * 下载远程 CSS 文件
 */
function downloadCss(url: string): Promise<string> {
  const finalUrl = url.startsWith('//') ? 'https:' + url : url;

  return new Promise((resolve, reject) => {
    const client = finalUrl.startsWith('https') ? https : http;
    const request = client.get(finalUrl, (res) => {
      // 处理重定向
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadCss(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(20000, () => {
      request.destroy();
      reject(new Error('请求超时'));
    });
  });
}

/**
 * 提取并合并所有 CSS 样式（包括远程 Docsify 主题）
 */
export async function extractAndMergeStyles(docsDir: string, downloadTheme: boolean = false): Promise<string> {
  const styles: string[] = [];

  // 1. 当启用 --theme 时，从 index.html 提取 CSS
  if (downloadTheme) {
    const indexPath = path.join(docsDir, 'index.html');
    if (exists(indexPath)) {
      const html = await readFile(indexPath);
      const cssLinks = extractCssLinks(html);

      for (const link of cssLinks) {
        if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('//')) {
          // 下载远程 CSS（如 Docsify 主题）
          try {
            info(`📥 Downloading remote CSS: ${link}`);
            let css: string | null = null;
            for (let attempt = 1; attempt <= 5; attempt++) {
              try {
                css = await downloadCss(link);
                break;
              } catch (err) {
                warn(`Failed to download remote CSS: ${link} - ${err} [${attempt}/5]`);
              }
            }
            if (css) {
              styles.push(`/* Remote: ${link} */\n${css}`);
              debug(`Download successful: ${link} (${(css.length / 1024).toFixed(1)} KB)`);
            } else {
              error(`Remote CSS download completely failed: ${link} (Source: ${indexPath})`);
            }
          } catch (err) {
            error(`Remote CSS download completely failed: ${link} (Source: ${indexPath}) - ${err}`);
          }
        } else {
          // 本地 CSS
          const cssPath = path.join(docsDir, link);
          if (exists(cssPath)) {
            const css = await readFile(cssPath);
            styles.push(`/* Source: ${link} */\n${css}`);
            debug(`Extracting local CSS: ${link}`);
          }
        }
      }

      // 提取内联 <style> 标签
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      let match;
      while ((match = styleRegex.exec(html)) !== null) {
        styles.push(`/* Inline style from index.html */\n${match[1]}`);
      }
    }
  }

  // 2. 未指定 --theme 时，添加默认的 EPUB 基础样式
  if (!downloadTheme) {
    styles.unshift(getDefaultEpubStyles());
  }

  // 3. 合并并清理
  const merged = styles.join('\n\n');
  return sanitizeForEpub(merged);
}

/**
 * 移除 EPUB 不兼容的 CSS 属性
 */
export function sanitizeForEpub(css: string): string {
  let result = css;

  // 移除 position: fixed/sticky
  result = result.replace(/position\s*:\s*(fixed|sticky)\s*;?/gi, '');

  // 移除 display: flex/grid (基本的，保留简单的)
  // 保守处理：只移除复杂的 flex/grid 布局声明
  result = result.replace(/display\s*:\s*(flex|inline-flex|grid|inline-grid)\s*;?/gi, '');
  result = result.replace(/flex-direction\s*:[^;]+;?/gi, '');
  result = result.replace(/flex-wrap\s*:[^;]+;?/gi, '');
  result = result.replace(/flex-flow\s*:[^;]+;?/gi, '');
  result = result.replace(/justify-content\s*:[^;]+;?/gi, '');
  result = result.replace(/align-items\s*:[^;]+;?/gi, '');
  result = result.replace(/align-content\s*:[^;]+;?/gi, '');
  result = result.replace(/grid-template[^;]*;?/gi, '');
  result = result.replace(/grid-area[^;]*;?/gi, '');

  // 移除 vw/vh 单位（替换为近似值）
  result = result.replace(/(\d+(?:\.\d+)?)vw/g, '$1%');
  result = result.replace(/(\d+(?:\.\d+)?)vh/g, '$1%');

  // 移除 transition 和 animation
  result = result.replace(/transition\s*:[^;]+;?/gi, '');
  result = result.replace(/animation\s*:[^;]+;?/gi, '');
  result = result.replace(/transform\s*:[^;]+;?/gi, '');

  // 移除 hover 等伪类中的交互式样式
  result = result.replace(/:hover\s*\{[^}]*\}/gi, '');
  result = result.replace(/:focus\s*\{[^}]*\}/gi, '');
  result = result.replace(/:active\s*\{[^}]*\}/gi, '');

  // 移除 @media 查询中的 screen 特定规则
  // 保留 @media print
  result = result.replace(/@media\s+screen[^{]*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/gi, '');

  return result;
}

/**
 * 获取默认的 EPUB 基础样式
 */
function getDefaultEpubStyles(): string {
  const cssPath = path.join(__dirname, '..', 'src', 'styles', 'default.css');
  // 优先从源码目录读取，回退到打包目录
  const altPath = path.join(__dirname, 'styles', 'default.css');

  if (fs.existsSync(cssPath)) {
    return fs.readFileSync(cssPath, 'utf-8');
  }
  if (fs.existsSync(altPath)) {
    return fs.readFileSync(altPath, 'utf-8');
  }

  // 最终回退：返回最小默认样式
  return `body { font-family: Georgia, serif; line-height: 1.6; margin: 1em; }
img { max-width: 100%; height: auto; }`;
}

