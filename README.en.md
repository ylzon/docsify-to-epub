[English](README.en.md) | [简体中文](README.md)

# docsify-to-epub

`docsify-to-epub` is a powerful command-line tool designed to convert your [Docsify](https://docsify.js.org/) documentation sites into structured EPUB ebooks with a single command.

## ✨ Features

- 📑 **Smart TOC Parsing**: Parses `_sidebar.md` to generate a hierarchical EPUB Table of Contents (TOC). If the sidebar file is missing, it automatically scans the directory structure.
- 🔗 **Headings & Navigation**: Automatically extracts nested Markdown sub-headings (h2, h3) for the TOC and resolves internal cross-chapter links.
- 🖼️ **Asset Management**: Automatically resolves, loads, and bundles both local and remote images. Supports resolving reference-style image links.
- 🎨 **Styles & Themes**: Easily inject custom CSS files. Use the `--theme` flag to fetch and bundle remote Docsify theme styles.
- 💻 **Syntax Highlighting**: Built-in code syntax highlighting ensures your code blocks look great in e-readers.
- 📚 **Metadata & Cover**: Set custom book titles, authors, and provide a cover image for your ebook.

## 📦 Installation

Install globally via npm:

```bash
npm install -g docsify-to-epub
```

Or run it directly using `npx`:

```bash
npx docsify-to-epub <dir>
```

## 🚀 Usage

Basic usage (assuming your documentation is inside the `docs` directory):

```bash
dte docs/
```

This will generate an `.epub` file in the current directory, typically named after your documentation site.

### CLI Options

```bash
dte <dir> [options]

Arguments:
  <dir>                      Path to the Docsify documentation directory

Options:
  -o, --output <file>        Output file path (default: <title>.epub)
  -t, --title <title>        Book title
  -a, --author <author>      Author name (default: "Unknown")
  -c, --cover <image>        Path to the cover image
  --css <file>               Path to a custom CSS file
  --theme                    Download remote Docsify theme styles
  -v, --verbose              Show verbose logs
  -h, --help                 Display help
```

### Examples

**1. Specify output path, title, and author**

```bash
dte docs/ -o output/my-book.epub -t "My Tech Docs" -a "John Doe"
```

**2. Add a cover image and use the remote theme style**

```bash
dte docs/ -c cover.jpg --theme
```

**3. Enable verbose logging**

```bash
dte docs/ -v
```

## 📄 License

[MIT](LICENSE)
