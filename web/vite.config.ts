import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  publicDir: path.resolve(import.meta.dirname, '../data/processed'),
  plugins: [react()],
  build: { chunkSizeWarningLimit: 2000 },
})
