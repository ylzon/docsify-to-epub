[English](README.en.md) | [简体中文](README.md)

# docsify-to-epub

`docsify-to-epub` 是一个将 [Docsify](https://docsify.js.org/) 文档站点转换为 EPUB 电子书的 CLI 工具

## ✨ 特性

- 📑 **智能目录解析**：支持解析生成具备层级结构的电子书目录（TOC）；在没有侧边栏文件时，也可以自动扫描目录结构。
- 🔗 **标题锚点与内部链接**：自动提取 Markdown 的嵌套标题，并支持跨章节的内部链接跳转。
- 🖼️ **图片资源管理**：自动解析和处理所有的本地和远程图片，并打包进 EPUB 中。支持解析引用式图片链接。
- 🎨 **样式与主题支持**：支持注入自定义 CSS 文件，并且可以通过 `--theme` 参数自动抓取远程 Docsify 主题样式。
- 💻 **代码高亮**：内置代码语法高亮支持，代码片段在电子书阅读器中也能清晰展示。
- 📚 **元数据与封面**：支持设置书籍标题、作者以及自定义封面图片。

## 📦 安装

您可以将其安装为本地或全局依赖：

```bash
npm install -g docsify-to-epub
```

或者直接使用 `npx` 运行：

```bash
npx docsify-to-epub <dir>
```

## 🚀 使用方法

基本的转换命令（假设您的文档存放在 `docs` 目录）：

```bash
dtoe docs/
```

```bash
dtoe docs/ -t "书籍标题" -a "作者" -c cover.jpg  --theme -v
```

这会在当前目录下生成一个与文档系统同名的 `.epub` 文件。

### 命令行选项

```bash
dtoe <dir> [options]

参数：
  <dir>                      Docsify 文档目录路径

选项：
  -o, --output <file>        输出文件路径 (默认: <书名>.epub)
  -t, --title <title>        书籍标题
  -a, --author <author>      作者名称 (默认: "Unknown")
  -c, --cover <image>        封面图片路径
  --css <file>               自定义 CSS 文件路径
  --theme                    下载远程 Docsify 主题样式
  -v, --verbose              显示详细日志
  -h, --help                 显示帮助信息
```

### 示例

**1. 指定输出文件、作者和书籍标题**

```bash
dtoe docs/ -o output/my-book.epub -t "我的技术文档" -a "John Doe"
```

**2. 添加封面图并使用远程主题样式**

```bash
dtoe docs/ -c cover.jpg --theme
```

**3. 显示详细构建日志**

```bash
dtoe docs/ -v
```

## 📄 许可证

[MIT](LICENSE)
