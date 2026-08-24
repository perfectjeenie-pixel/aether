Updated README: added Supabase integration notes, Signal integration plan, and Vercel env guidance.

Key changes:
- We will use Supabase for managed Postgres, realtime, and storage by default.
- The web client will use libsignal-protocol-js for E2EE key generation and prekey publishing.
- The server scaffold now can persist public keys, prekeys, and message metadata to Supabase when SUPABASE_* vars are present.

Deployment notes:
- Create a Supabase project and run server/supabase_schema.sql to create required tables.
- Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel for the web client.
- Set SUPABASE_SERVICE_ROLE_KEY (server-side) in your server environment — keep it secret.
- For Vercel deployment of the web client, set NEXT_PUBLIC_API_URL to the backend or to a serverless endpoint.
