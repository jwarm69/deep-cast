import { BackendClient, BackendProvider } from './types';
import { LocalBackendClient } from './local/LocalBackendClient';
import { SupabaseBackendClient } from './supabase/SupabaseBackendClient';

interface BackendEnv {
  VITE_BACKEND_PROVIDER?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

function parseProvider(input: string | undefined): BackendProvider {
  if (input === 'supabase') return 'supabase';
  return 'local';
}

export function createBackendClient(): BackendClient {
  const env = (import.meta as ImportMeta & { env: BackendEnv }).env;
  const provider = parseProvider(env.VITE_BACKEND_PROVIDER);

  if (provider === 'supabase') {
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
      console.warn(
        '[multiplayer] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Falling back to local backend.',
      );
      return new LocalBackendClient();
    }
    return new SupabaseBackendClient({
      url: env.VITE_SUPABASE_URL,
      anonKey: env.VITE_SUPABASE_ANON_KEY,
    });
  }

  return new LocalBackendClient();
}
