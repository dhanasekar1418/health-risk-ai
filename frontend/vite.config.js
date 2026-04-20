import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/analyze':  'http://localhost:5000',
      '/sessions': 'http://localhost:5000',
      '/patients': 'http://localhost:5000',
      '/stats':    'http://localhost:5000',
      '/health':   'http://localhost:5000',
    }
  }
})
