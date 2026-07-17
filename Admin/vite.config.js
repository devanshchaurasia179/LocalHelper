import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    // Proxy API calls to the backend so the httpOnly cookie is sent
    // on the same origin in development.
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // Split vendor libraries into separate chunks so browsers can
    // cache them independently from app code.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':   ['@tanstack/react-query', '@tanstack/react-query-devtools'],
          'vendor-ui':      ['framer-motion', 'lucide-react'],
          'vendor-charts':  ['recharts'],
          'vendor-forms':   ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-utils':   ['axios', 'react-hot-toast', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
})
