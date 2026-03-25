import { defineConfig } from 'tsup';
import { cpSync } from 'fs';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['cjs'],
  dts: true,
  clean: true,
  splitting: false,
  shims: true,
  onSuccess: async () => {
    // 将 CSS 样式文件复制到 dist/styles/
    cpSync('src/styles', 'dist/styles', { recursive: true });
    console.log('✅ Copied styles to dist/styles/');
  },
});
