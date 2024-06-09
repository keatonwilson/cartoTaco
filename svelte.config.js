import { config } from 'dotenv';
import adapter from '@sveltejs/adapter-auto';

config();

export default {
  kit: {
    adapter: adapter(),
    vite: {
      define: {
        'process.env': process.env
      }
    }
  }
};
