# 配置说明

## 基本配置

在 `index.html` 中配置 Docsify：

```html
<script>
  window.$docsify = {
    name: '我的文档',
    loadSidebar: true
  }
</script>
```

## 高级配置

### 自定义样式

可以通过 `--css` 参数注入自定义样式：

```bash
dte ./docs --css custom.css
```
