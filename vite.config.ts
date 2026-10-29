import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/upstox': {
        target: 'https://api.upstox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/upstox/, ''),
      },
      '/api/nse': {
        target: 'https://www.nseindia.com',
        changeOrigin: true,
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.nseindia.com/option-chain',
        },
        rewrite: (path) => path.replace(/^\/api\/nse/, ''),
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.warn('[NSE Proxy Warning]:', err.message);
            if (res && 'writeHead' in res && !(res as any).headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'NSE proxy error', message: err.message }));
            }
          });
        },
      },
      '/api/angelone': {
        target: 'https://apiconnect.angelone.in',
        changeOrigin: true,
        secure: false,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        rewrite: (path) => path.replace(/^\/api\/angelone/, ''),
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.warn('[AngelOne Proxy Warning]:', err.message);
            if (res && 'writeHead' in res && !(res as any).headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Angel One proxy error', message: err.message }));
            }
          });
        },
      },
    },
  },
})
