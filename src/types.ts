/** CLI 选项 */
export interface CliOptions {
  output: string;
  title?: string;
  author?: string;
  cover?: string;
  lang: string;
  css?: string;
  theme: boolean;
  verbose: boolean;
}

/** 章节定义 */
export interface Chapter {
  id: string;
  title: string;
  path: string;
  level: number;
  content?: string;
  xhtml?: string;
  children: Chapter[];
}

/** 扁平化章节（用于 EPUB 生成） */
export interface ChapterContent {
  id: string;
  title: string;
  filename: string;
  xhtml: string;
  level: number;
  subHeadings?: SubHeading[];
}

/** 章节内子标题 */
export interface SubHeading {
  title: string;
  anchor: string;
  level: number; // 2 = h2, 3 = h3
}

/** 层级目录条目（从 sidebar 层级结构生成） */
export interface TocEntry {
  /** 显示标题（已去除 HTML 标签） */
  title: string;
  /** 目标文件名，如 "chapter-001.xhtml"；无链接条目解析为第一个后代的文件名 */
  filename: string;
  /** 子条目 */
  children: TocEntry[];
}

/** 图片资源 */
export interface ImageAsset {
  id: string;
  originalPath: string;
  epubPath: string;
  filename: string;
  mediaType: string;
  data: Buffer;
}

/** EPUB 完整内容 */
export interface EpubContent {
  metadata: BookMetadata;
  chapters: ChapterContent[];
  images: ImageAsset[];
  opf: string;
  ncx: string;
  nav: string;
  css: string;
  highlightCss: string;
}

/** 书籍元数据 */
export interface BookMetadata {
  title: string;
  author: string;
  language: string;
  identifier: string;
  publisher?: string;
  description?: string;
  cover?: string;
  date: string;
}

/** Docsify 配置 */
export interface DocsifyConfig {
  name?: string;
  htmlTitle?: string;
  basePath?: string;
  coverpage?: boolean | string;
  loadSidebar?: boolean | string;
  subMaxLevel?: number;
  auto2top?: boolean;
}
