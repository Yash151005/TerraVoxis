/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Content security policy, added to the built index.html only (the dev server injects styles
 * that a strict policy would block). No inline scripts; media and images may be blob: or data:.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'terravoxis-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const base = env.VITE_BASE_PATH || process.env.VITE_BASE_PATH || '/';
  return {
    base,
    plugins: [react(), tailwindcss(), cspPlugin()],
    build: { target: 'es2022', sourcemap: false },
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
    },
  };
});
