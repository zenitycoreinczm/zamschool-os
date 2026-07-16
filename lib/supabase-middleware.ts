// REMOVED - dead code. This file was unused (updateSession was never imported).
// Auth session resolution happens in middleware.ts via cookie-only (middleware-auth-session.ts),
// which avoids supabase.auth.getUser() API calls on every page load.
