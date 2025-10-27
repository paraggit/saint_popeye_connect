import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Check if SSL certificates exist
const certPath = path.resolve(__dirname, 'certs/cert.pem')
const keyPath = path.resolve(__dirname, 'certs/key.pem')
const sslEnabled = fs.existsSync(certPath) && fs.existsSync(keyPath)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_OLLAMA_HOST || 'https://192.168.1.6:11434',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        rewrite: (path: string) => path,
      }
    }
  },
  preview: {
    https: sslEnabled ? {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath)
    } : undefined,
    proxy: {
      '/api': {
        target: process.env.VITE_OLLAMA_HOST || 'https://192.168.1.6:11434',
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => path,
      }
    }
  }
})
