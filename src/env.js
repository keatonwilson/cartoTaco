// src/env.js
import { config } from 'dotenv';

config();

const env = {
  SUPABASE_URL: process.env.VITE_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.VITE_PUBLIC_SUPABASE_KEY
};

if (!env.SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!env.SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_ANON_KEY environment variable');
}

export { env };
