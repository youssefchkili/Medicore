import { createPublicKey } from 'node:crypto';

// Fetched once at startup, shared between all JWT strategies.
let cachedPublicKey: string | null = null;
let keyFetchPromise: Promise<string> | null = null;

export function resolvePublicKey(supabaseUrl: string): Promise<string> {
  if (cachedPublicKey) return Promise.resolve(cachedPublicKey);
  if (keyFetchPromise) return keyFetchPromise;

  keyFetchPromise = fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
    .then(r => r.json() as Promise<{ keys: JsonWebKey[] }>)
    .then(({ keys }) => {
      if (!keys?.length) throw new Error('Supabase JWKS returned no keys');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pem = createPublicKey({ key: keys[0] as any, format: 'jwk' })
        .export({ type: 'spki', format: 'pem' }) as string;
      cachedPublicKey = pem;
      return pem;
    });

  return keyFetchPromise;
}
