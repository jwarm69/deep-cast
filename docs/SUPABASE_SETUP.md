# Supabase Wiring Notes

This project now includes a backend abstraction so gameplay code can stay unchanged while switching providers.

## Current State

- Default provider: `local`
- Backend factory: `src/backend/createBackendClient.ts`
- Multiplayer bridge: `src/multiplayer/MultiplayerBridge.ts`
- Spot mapping: `src/multiplayer/fishing-spots.ts`
- Supabase adapter scaffold: `src/backend/supabase/SupabaseBackendClient.ts`

## Env Vars

Copy `.env.example` to `.env.local` and set:

- `VITE_BACKEND_PROVIDER=supabase`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

If Supabase vars are missing, the app falls back to local backend.

## Next Implementation Step

1. Install Supabase client:
   - `npm install @supabase/supabase-js`
2. Implement `SupabaseBackendClient`:
   - create client
   - anonymous sign-in
   - realtime channel presence sync by `terrain` and/or `spotId`
   - map remote presence records to `RemotePresenceState[]`
3. Emit remote anglers into a render system using `Events.PRESENCE_UPDATED`.
