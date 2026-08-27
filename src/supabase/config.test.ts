import { describe, it } from 'node:test';
import { resolveSupabaseConfig } from './config';
describe('Supabase config', () => {
  it('returns null when missing', () => { if (resolveSupabaseConfig({}) !== null) throw new Error('expected null'); });
  it('accepts public key', () => { if (!resolveSupabaseConfig({ url: 'https://demo.supabase.co', anonKey: 'public-key' })) throw new Error('expected config'); });
  it('rejects secret key', () => { if (resolveSupabaseConfig({ url: 'https://demo.supabase.co', anonKey: 'service_role-secret' }) !== null) throw new Error('secret key accepted'); });
});
