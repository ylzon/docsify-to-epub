import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { readFile, exists } from '../utils/fs.js';
import { extractCssLinks } from '../parser/config.js';
import { debug, warn, info } from '../utils/logger.js';

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
    request.setTimeout(10000, () => {
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

  // 1. 尝试从 index.html 提取 CSS 链接
  const indexPath = path.join(docsDir, 'index.html');
  if (exists(indexPath)) {
    const html = await readFile(indexPath);
    const cssLinks = extractCssLinks(html);

    for (const link of cssLinks) {
      if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('//')) {
        if (downloadTheme) {
          // 下载远程 CSS（如 Docsify 主题）
          try {
            info(`📥 下载远程 CSS: ${link}`);
            const css = await downloadCss(link);
            styles.push(`/* Remote: ${link} */\n${css}`);
            debug(`下载成功: ${link} (${(css.length / 1024).toFixed(1)} KB)`);
          } catch (err) {
            warn(`下载远程 CSS 失败: ${link} - ${err}`);
          }
        } else {
          debug(`跳过远程 CSS (使用 --theme 开启下载): ${link}`);
        }
      } else {
        // 本地 CSS
        const cssPath = path.join(docsDir, link);
        if (exists(cssPath)) {
          const css = await readFile(cssPath);
          styles.push(`/* Source: ${link} */\n${css}`);
          debug(`提取本地 CSS: ${link}`);
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

  // 2. 添加默认的 EPUB 基础样式
  styles.unshift(getDefaultEpubStyles());

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
  return `
/* docsify-to-epub 默认样式 */
body {
  font-family: Georgia, 'Times New Roman', serif;
  line-height: 1.6;
  // color: #333;
  margin: 1em;
  font-size: 1em;
}

h1 {
  font-size: 1.8em;
  margin-top: 1em;
  margin-bottom: 0.5em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.3em;
  // color: #1a1a1a;
}

h2 {
  font-size: 1.5em;
  margin-top: 0.8em;
  margin-bottom: 0.4em;
  // color: #2c3e50;
}

h3 {
  font-size: 1.3em;
  margin-top: 0.6em;
  margin-bottom: 0.3em;
  // color: #34495e;
}

h4, h5, h6 {
  font-size: 1.1em;
  margin-top: 0.5em;
  margin-bottom: 0.2em;
}

p {
  margin: 0.5em 0;
  text-align: justify;
}

a {
  color: #3498db;
  text-decoration: none;
}

blockquote {
  border-left: 4px solid #42b983;
  padding: 0.5em 1em;
  margin: 1em 0;
  background: #f8f8f8;
  color: #666;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

th {
  background: #f5f5f5;
  font-weight: bold;
}

img {
  max-width: 100%;
  height: auto;
}

ul, ol {
  padding-left: 2em;
}

li {
  margin: 0.3em 0;
}

hr {
  border: none;
  border-top: 1px solid #eee;
  margin: 2em 0;
}

/* Docsify 提示框样式 */
.tip {
  background: #f0f7fb;
  border-left: 4px solid #3498db;
  padding: 0.75em 1em;
  margin: 1em 0;
  border-radius: 0 4px 4px 0;
}

.tip p { margin: 0; }

.warn {
  background: #fdf6ec;
  border-left: 4px solid #f0ad4e;
  padding: 0.75em 1em;
  margin: 1em 0;
  border-radius: 0 4px 4px 0;
}

.warn p { margin: 0; }
`.trim();
}
