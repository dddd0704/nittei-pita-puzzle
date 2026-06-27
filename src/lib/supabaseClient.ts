import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !String(supabaseUrl).includes('ここに') &&
  !String(supabaseKey).includes('ここに')
);

export const supabase = supabaseReady
  ? createClient(supabaseUrl, supabaseKey)
  : null;