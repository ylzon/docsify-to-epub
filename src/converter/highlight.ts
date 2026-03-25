import hljs from 'highlight.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 对代码进行语法高亮处理
 */
export function highlightCode(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } catch {
      // fallback
    }
  }
  try {
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 获取 highlight.js 的内置 CSS 主题
 */
export function getHighlightCss(): string {
  const cssPath = path.join(__dirname, '..', 'src', 'styles', 'highlight.css');
  const altPath = path.join(__dirname, 'styles', 'highlight.css');

  if (fs.existsSync(cssPath)) {
    return fs.readFileSync(cssPath, 'utf-8');
  }
  if (fs.existsSync(altPath)) {
    return fs.readFileSync(altPath, 'utf-8');
  }

  // 最终回退
  return `pre { border-radius: 6px; padding: 16px; overflow-x: auto; }
code { border-radius: 3px; padding: 0.2em 0.4em; font-size: 85%; }`;
}
