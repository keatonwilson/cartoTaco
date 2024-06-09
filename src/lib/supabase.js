// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  throw new Error('Supabase URL or ANON KEY is missing');
}

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
