import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    'process.env': process.env
  },
  server: {
    host: true, // Expose to local network (same as '0.0.0.0')
    port: 5175,
    strictPort: false // Try next port if 5175 is taken
  }
});
