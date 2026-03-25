import MarkdownIt from 'markdown-it';
import * as cheerio from 'cheerio';
import { highlightCode } from './highlight.js';
import type { SubHeading } from '../types.js';

/**
 * 创建配置好的 markdown-it 实例
 */
function createMarkdownRenderer(): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    xhtmlOut: true,    // 输出 XHTML 兼容的自闭合标签 (<br />, <img />, <hr />)
    linkify: true,
    typographer: true,
    highlight: (code: string, lang: string) => {
      const highlighted = highlightCode(code, lang);
      return `<pre><code class="hljs language-${lang || 'plaintext'}">${highlighted}</code></pre>`;
    },
  });

  return md;
}

const mdRenderer = createMarkdownRenderer();

/**
 * 处理 Docsify 特殊语法，在 markdown-it 解析前预处理
 */
function preprocessDocsify(content: string): string {
  let result = content;

  // 处理 !> 提示框 → 转换为 HTML div
  result = result.replace(
    /^!>\s*(.+)$/gm,
    '<div class="tip"><p>$1</p></div>'
  );

  // 处理 ?> 提示框 → 转换为 HTML div
  result = result.replace(
    /^\?>\s*(.+)$/gm,
    '<div class="warn"><p>$1</p></div>'
  );

  // 移除 docsify-ignore 标注
  result = result.replace(/<!--\s*\{docsify-ignore\}\s*-->/g, '');
  result = result.replace(/<!--\s*\{docsify-ignore-all\}\s*-->/g, '');

  // 移除 tabs 标记，保留内容
  result = result.replace(/<!--\s*tabs:start\s*-->/g, '');
  result = result.replace(/<!--\s*tabs:end\s*-->/g, '');
  result = result.replace(/<!--\s*tab:\s*(.+?)\s*-->/g, '\n#### $1\n');

  return result;
}

/**
 * 确保 HTML 输出是合法的 XHTML（修复缺少引号的属性及闭合所有的 void 元素）
 */
function sanitizeXhtml(html: string): string {
  // 使用 cheerio 加载 HTML 片段并生成严格的 XML（XHTML）
  const $ = cheerio.load(html, null, false);
  return $.xml();
}

/**
 * 将 Markdown 转换为 EPUB 兼容的 XHTML body 内容
 * 同时处理内部链接和图片路径
 */
export function convertMarkdown(
  content: string,
  chapterMap: Map<string, string>,
  imageMap: Map<string, string>
): string {
  // 预处理 Docsify 语法
  const preprocessed = preprocessDocsify(content);

  // 渲染 Markdown → HTML
  let html = mdRenderer.render(preprocessed);

  // 修复内部链接：将 .md 链接转换为 EPUB 内部引用
  html = html.replace(
    /href="([^"]*\.md(?:#[^"]*)?)"/g,
    (match, href) => {
      const [mdPath, anchor] = href.split('#');
      const normalized = normalizeMdPath(mdPath);
      const epubRef = chapterMap.get(normalized);
      if (epubRef) {
        return `href="${epubRef}${anchor ? '#' + anchor : ''}"`;
      }
      return match;
    }
  );

  // 修复图片路径
  html = html.replace(
    /src="([^"]+)"/g,
    (match, src) => {
      if (src.startsWith('data:')) {
        return match;
      }
      const epubPath = imageMap.get(src);
      if (epubPath) {
        return `src="${epubPath}"`;
      }
      return match;
    }
  );

  // 确保输出是合法 XHTML
  html = sanitizeXhtml(html);

  return html;
}

/**
 * 将 HTML 内容包装为完整的 XHTML 文档
 */
export function wrapXhtml(title: string, bodyHtml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="../stylesheet.css" />
  <link rel="stylesheet" type="text/css" href="../highlight.css" />
</head>
<body class="markdown-section">
${bodyHtml}
</body>
</html>`;
}

function normalizeMdPath(p: string): string {
  let normalized = p;
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  if (normalized === '' || normalized === '/') normalized = 'README.md';
  if (!normalized.endsWith('.md')) normalized += '.md';
  return normalized;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 从 Markdown 源文本中提取 h2/h3 子标题
 */
export function extractHeadings(markdownContent: string): SubHeading[] {
  const headings: SubHeading[] = [];
  // 匹配 ## 和 ### 标题
  const headingRegex = /^(#{2})\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(markdownContent)) !== null) {
    const level = match[1].length; // 2 or 3
    const title = match[2].trim()
      .replace(/<!--.*?-->/g, '')  // 移除 HTML 注释
      .replace(/\{.*?\}/g, '')      // 移除 docsify 标注
      .trim();

    if (!title) continue;

    // 生成锚点 ID（与 markdown-it 默认行为一致）
    const anchor = title
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff\s-]/g, '')  // 保留中英文、数字、空格、连字符
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    headings.push({ title, anchor, level });
  }

  return headings;
}

/**
 * 在 XHTML 中为 h2/h3 标签注入 id 属性（用于锚点跳转）
 */
export function addHeadingIds(xhtml: string): string {
  let h2Count = 0;
  let h3Count = 0;

  return xhtml.replace(
    /<(h[23])(\s[^>]*)?>([^<]+)<\/h[23]>/gi,
    (match, tag, attrs, text) => {
      const title = text.trim();
      const anchor = title
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // 检查是否已有 id 属性
      if (attrs && /id\s*=/.test(attrs)) {
        return match;
      }

      return `<${tag} id="${anchor}"${attrs || ''}>${text}</${tag}>`;
    }
  );
}
