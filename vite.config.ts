import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// "single" baut eine einzige HTML-Datei (für schnelle Testvorschau).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [preact(), viteSingleFile()] : [preact()],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}));
