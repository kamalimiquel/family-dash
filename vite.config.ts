import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El backend Express (server/) sirve el build y la API en el puerto 4173.
// En desarrollo, Vite va por su lado y le pasa /api al backend.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4173',
        changeOrigin: false,
      },
    },
  },
})
