/**
 * docsify-to-epub
 * 将 Docsify 文档站点转换为 EPUB 电子书
 */

// Parser
export { parseSidebar, flattenChapters, extractConfig, scanForChapters } from './parser/index.js';

// Converter
export { convertMarkdown, wrapXhtml, getHighlightCss, extractAndMergeStyles, collectImageRefs, loadImages, buildChapterImageMap, resolveImageRefs } from './converter/index.js';

// Generator
export { generateOpf, generateNcx, generateNav, createEpub } from './generator/index.js';

// Types
export type {
  CliOptions,
  Chapter,
  ChapterContent,
  ImageAsset,
  EpubContent,
  BookMetadata,
  DocsifyConfig,
} from './types.js';
