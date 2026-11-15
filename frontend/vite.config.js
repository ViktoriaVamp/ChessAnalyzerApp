import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [
    react(),
    mkcert() 
  ],
  server: {
    https: true,
    port: 5173,
    
    proxy: {
      '/api': {
        target: 'https://chess.local',
        changeOrigin: true,
        secure: false 
      }
    }
  }
});