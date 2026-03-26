#!/usr/bin/env node

import { Command } from 'commander';
import { version } from '../package.json';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { CliOptions, BookMetadata, Chapter, ChapterContent } from './types.js';
import { parseSidebar, flattenChapters, buildTocTree, extractConfig, scanForChapters } from './parser/index.js';
import { convertMarkdown, wrapXhtml, getHighlightCss, extractAndMergeStyles, collectImageRefs, loadImages, resolveImageRefs, addHeadingIds, extractHeadings } from './converter/index.js';
import { generateOpf, generateNcx, generateNav, createEpub } from './generator/index.js';
import { readFile, exists, readFileBuffer, getMediaType, setVerbose, info, success, error, warn, debug, progress, progressEnd } from './utils/index.js';

const program = new Command();

program
  .name('dtoe')
  .description('将 Docsify 文档转换为 EPUB 电子书')
  .version(version)
  .argument('<dir>', 'Docsify 文档目录路径')
  .option('-o, --output <file>', '输出文件路径 (默认: <书名>.epub)')
  .option('-t, --title <title>', '书籍标题')
  .option('-a, --author <author>', '作者名称', 'Unknown')
  .option('-c, --cover <image>', '封面图片路径')
  .option('--css <file>', '自定义 CSS 文件路径')
  .option('--theme', '下载远程 Docsify 主题样式', false)
  .option('-v, --verbose', '显示详细日志', false)
  .action(async (dir: string, options: CliOptions) => {
    try {
      if (options.verbose) {
        setVerbose(true);
      }

      await convert(dir, options);
    } catch (err: any) {
      error(err.message || String(err));
      process.exit(1);
    }
  });

program.parse();

/**
 * 主转换流程
 */
async function convert(dir: string, options: CliOptions): Promise<void> {
  const docsDir = path.resolve(dir);

  // 1. 验证目录
  if (!exists(docsDir)) {
    throw new Error(`Directory not found: ${docsDir}`);
  }
  info(`📂 Document directory: ${docsDir}`);

  // 2. 提取 Docsify 配置
  const config = await extractConfig(docsDir);
  const bookTitle = options.title || config.name || config.htmlTitle || path.basename(docsDir);
  info(`📖 Book title: ${bookTitle}`);

  // 3. 解析章节结构
  let chapters: Chapter[];
  const sidebarPath = path.join(docsDir, '_sidebar.md');

  if (exists(sidebarPath)) {
    info('📋 Found _sidebar.md, parsing sidebar structure...');
    const sidebarContent = await readFile(sidebarPath);
    chapters = parseSidebar(sidebarContent);
  } else {
    info('📋 No _sidebar.md found, scanning directory structure...');
    chapters = await scanForChapters(docsDir);
  }

  // 4. 扁平化章节列表
  const flatChapters = flattenChapters(chapters);
  const chaptersWithContent = flatChapters.filter(ch => ch.path);
  info(`📄 Total ${chaptersWithContent.length} chapters`);

  // 5. 读取各章节的 Markdown 内容
  for (const chapter of chaptersWithContent) {
    const mdPath = path.join(docsDir, chapter.path);
    if (exists(mdPath)) {
      chapter.content = await readFile(mdPath);
      debug(`Reading: ${chapter.path}`);
    } else {
      warn(`File not found: ${chapter.path}`);
      chapter.content = `# ${chapter.title}\n\n> 此章节内容缺失`;
    }
  }

  // 5.5 预处理：自动解析未定义的引用式图片（如 ![][00-01]）
  info('🔍 Resolving reference-style images...');
  for (const chapter of chaptersWithContent) {
    chapter.content = resolveImageRefs(chapter, docsDir);
  }

  // 6. 收集和加载图片
  info('🖼️  Start processing image resources...');
  const imageRefs = collectImageRefs(chaptersWithContent);
  const { images, imageMap } = await loadImages(imageRefs, docsDir, (current, total) => {
    progress(`🖼️  Processing image (${current}/${total})`);
  });
  if (imageRefs.length > 0) {
    progressEnd(`🖼️  Processing image (${images.length}/${imageRefs.length})`);
  }
  debug(`Loaded ${images.length} images`);

  // 7. 构建章节映射（用于内部链接转换）
  const chapterMap = new Map<string, string>();
  const chapterContents: ChapterContent[] = [];

  for (let i = 0; i < chaptersWithContent.length; i++) {
    const ch = chaptersWithContent[i];
    const filename = `${ch.id}.xhtml`;
    chapterMap.set(ch.path, `../chapters/${filename}`);
  }

  // 8. 转换 Markdown → XHTML
  info('🔄 Converting Markdown to XHTML...');
  for (const ch of chaptersWithContent) {
    // 构建该章节的图片路径映射（相对于章节目录解析）
    const chapterDir = ch.path ? path.dirname(ch.path) : '.';
    const chapterImageMap = new Map<string, string>();

    for (const [normalizedKey, epubPath] of imageMap) {
      // 1. 添加规范化路径
      chapterImageMap.set(normalizedKey, epubPath);
      // 2. 计算从章节目录到图片的相对路径（这是 markdown-it 渲染后 src 中的值）
      const relPath = path.relative(chapterDir, normalizedKey);
      chapterImageMap.set(relPath, epubPath);
    }
    // 3. 同时保留原始引用路径
    for (const ref of imageRefs) {
      if (ref.remote) {
        // 远程图片：直接用 URL 作为 key
        const epubPath = imageMap.get(ref.src);
        if (epubPath) {
          chapterImageMap.set(ref.src, epubPath);
        }
      } else {
        const normalized = path.normalize(path.join(ref.chapterDir || '.', ref.src));
        const epubPath = imageMap.get(normalized);
        if (epubPath) {
          chapterImageMap.set(ref.src, epubPath);
        }
      }
    }

    let bodyHtml = convertMarkdown(ch.content || '', chapterMap, chapterImageMap);
    bodyHtml = addHeadingIds(bodyHtml);

    const xhtml = wrapXhtml(ch.title, bodyHtml);

    const subHeadings = extractHeadings(ch.content || '');

    chapterContents.push({
      id: ch.id,
      title: ch.title,
      filename: `${ch.id}.xhtml`,
      xhtml,
      level: ch.level,
      subHeadings,
    });
    debug(`Converting: ${ch.title}`);
  }

  // 9. 处理 CSS 样式
  info('🎨 Processing styles...');
  let css = await extractAndMergeStyles(docsDir, options.theme);

  // 注入自定义 CSS
  if (options.css) {
    const customCssPath = path.resolve(options.css);
    if (exists(customCssPath)) {
      const customCss = await readFile(customCssPath);
      css += `\n\n/* Custom CSS */\n${customCss}`;
      debug(`Injecting custom CSS: ${customCssPath}`);
    }
  }

  const highlightCss = getHighlightCss();

  // 9.5 处理封面图片
  if (options.cover) {
    const coverPath = path.resolve(options.cover);
    if (exists(coverPath)) {
      info('🖼️  Loading cover image...');
      try {
        const data = await readFileBuffer(coverPath);
        const ext = path.extname(coverPath).toLowerCase() || '.jpg';
        const mediaType = getMediaType(coverPath);

        images.push({
          id: 'cover-image',
          originalPath: coverPath,
          epubPath: `images/cover${ext}`,
          filename: `cover${ext}`,
          mediaType,
          data,
        });
      } catch (err) {
        warn(`Failed to read cover image: ${options.cover}`);
        options.cover = undefined;
      }
    } else {
      warn(`Cover image not found: ${options.cover}`);
      options.cover = undefined;
    }
  }

  // 10. 生成 EPUB 元数据
  const metadata: BookMetadata = {
    title: bookTitle,
    author: options.author || 'Unknown',
    identifier: uuidv4(),
    date: new Date().toISOString().split('T')[0],
    cover: options.cover,
  };

  // 11. 生成 OPF、NCX、NAV
  info('📝 Generating EPUB metadata...');

  // 构建层级目录树
  const filenameMap = new Map<string, string>();
  for (const cc of chapterContents) {
    filenameMap.set(cc.id, cc.filename);
  }
  const tocTree = buildTocTree(chapters, filenameMap, chapterContents);

  const opf = generateOpf(metadata, chapterContents, images);
  const ncx = generateNcx(metadata.identifier, metadata.title, tocTree);
  const nav = generateNav(metadata.title, tocTree);

  // 12. 打包 EPUB
  const defaultOutput = `./${bookTitle}.epub`;
  const outputPath = path.resolve(options.output || defaultOutput);
  info(`📦 Packing EPUB: ${outputPath}`);

  await createEpub(outputPath, {
    metadata,
    chapters: chapterContents,
    images,
    opf,
    ncx,
    nav,
    css,
    highlightCss,
  });

  success(`✅ EPUB generated successfully: ${outputPath}`);
  info(`   Chapters: ${chapterContents.length} | Images: ${images.length}`);
}
