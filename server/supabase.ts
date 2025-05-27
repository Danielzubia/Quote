import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL must be set in environment variables');
}

if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY must be set in environment variables');
}

// Supabase client initialization with auto-confirmation enabled
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);