// src/lib/supabaseBrowser.js
// Browser-side Supabase client with cookie support for SSR

import { createBrowserClient } from '@supabase/ssr';
import { browser } from '$app/environment';

export const supabaseBrowser = browser
  ? createBrowserClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
  : null;
