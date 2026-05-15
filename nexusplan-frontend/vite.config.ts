import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'lottie-react': path.resolve(__dirname, 'node_modules/lottie-react/build/index.es.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['lottie-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://nexusplan.duckdns.org',
        changeOrigin: true,
        secure: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
