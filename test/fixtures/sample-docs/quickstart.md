# 快速开始

## 安装

```bash
npm install -g docsify-to-epub
```

## 使用方法

使用 `dte` 命令即可将 Docsify 文档转换为 EPUB：

```bash
dte ./docs -o output.epub
```

| 参数 | 描述 | 默认值 |
|------|------|--------|
| `-o` | 输出路径 | `./output.epub` |
| `-t` | 书名 | 从配置读取 |
| `-a` | 作者 | `Unknown` |
