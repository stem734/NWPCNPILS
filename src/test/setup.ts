import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Provide placeholder Supabase env vars so modules that eagerly instantiate the
// client (src/supabase.ts) don't throw on import during unit tests. Real RPC
// calls should be mocked at the test level.
if (!import.meta.env.VITE_SUPABASE_URL) {
  import.meta.env.VITE_SUPABASE_URL = 'http://localhost:54321';
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-anon-key';
}

// Automatically clean up after each test to avoid DOM bleed between tests.
afterEach(() => {
  cleanup();
});
