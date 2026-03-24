# API 参考

## `parseSidebar(content, basePath?)`

解析 `_sidebar.md` 文件内容。

**参数：**

- `content` (string) - sidebar 文件内容
- `basePath` (string, optional) - 基础路径

**返回值：** `Chapter[]`

## `convertMarkdown(content, chapterMap, imageMap)`

将 Markdown 内容转换为 EPUB 兼容的 XHTML。

**参数：**

- `content` (string) - Markdown 内容
- `chapterMap` (Map) - 章节路径映射
- `imageMap` (Map) - 图片路径映射

**返回值：** `string` (XHTML)
