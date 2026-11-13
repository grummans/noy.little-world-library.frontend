import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

// Covers and EPUBs come from MinIO through presigned URLs, which have a different origin
// than the app, so the CSP in index.html must name that origin. It differs per
// environment: LAN MinIO in development, media.littleworld.cloud in production.
function cspMediaOrigin(env: Record<string, string>, mode: string): string {
  if (env.VITE_MEDIA_ORIGIN) return env.VITE_MEDIA_ORIGIN.replace(/\/$/, '')
  return mode === 'development'
    ? 'http://192.168.1.48:9000'
    : 'https://media.littleworld.cloud'
}

function cspPlugin(env: Record<string, string>, mode: string): Plugin {
  const origin = cspMediaOrigin(env, mode)
  return {
    name: 'little-world-csp',
    transformIndexHtml(html) {
      return html.replaceAll('%MEDIA_ORIGIN%', origin)
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv reads .env files as well as the process environment.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), tailwindcss(), cspPlugin(env, mode)],
    server: {
      // During development the Go API runs on :8080; proxying keeps /api same-origin so
      // the session cookie works without CORS.
      proxy: {
        // changeOrigin stays false so the API sees the browser's Host and its Origin check
        // (CSRF guard) compares like with like.
        '/api': { target: env.API_PROXY ?? 'http://localhost:8080', changeOrigin: false },
      },
    },
  }
})
