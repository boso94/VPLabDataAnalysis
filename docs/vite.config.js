import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

const staticFiles = ['style.css', 'analyze.py'];

function copyStaticFiles() {
  return {
    name: 'copy-static-files',
    closeBundle() {
      for (const file of staticFiles) {
        const src = resolve(__dirname, file);
        const dest = resolve(__dirname, 'dist', file);
        if (existsSync(src)) {
          copyFileSync(src, dest);
        }
      }
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        analysis: resolve(__dirname, 'analysis.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  plugins: [copyStaticFiles()],
  server: {
    open: false,
  },
});
