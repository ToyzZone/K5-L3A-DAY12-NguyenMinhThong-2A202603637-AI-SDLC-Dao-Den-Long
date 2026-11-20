import { defineConfig } from 'vite';

// ponytail: tsc cũng xuất ra dist/; tách bản web vào dist/web để vite build không xóa dist/headless.js.
export default defineConfig({ build: { outDir: 'dist/web' } });
