import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Hosts públicos usados pelos túneis HTTPS do Sandbox local.
    allowedHosts: ['.trycloudflare.com', 'sandbox-console.anysale.com.br'],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/catalog-api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/catalog-api/, ''),
      },
      '/billing-api': {
        target: 'http://localhost:8084',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/billing-api/, ''),
      },
    },
  },
})
