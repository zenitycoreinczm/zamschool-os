import { checkSupabaseConnectivity, resolveSupabaseHostname } from "../lib/supabase-connectivity.ts";

const hostname = resolveSupabaseHostname();

if (!hostname) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing or invalid in .env.local");
  process.exit(1);
}

console.log(`Checking Supabase host: ${hostname}`);

const result = await checkSupabaseConnectivity();

if (result.ok) {
  console.log(`OK — reachable (HTTP ${result.status})`);
  process.exit(0);
}

console.error(`FAILED — ${result.error}`);
console.error("");
console.error("Try:");
console.error("  1. Confirm the project is active in the Supabase dashboard");
console.error("  2. Verify NEXT_PUBLIC_SUPABASE_URL in .env.local");
console.error("  3. Check VPN/firewall/DNS (ipconfig /flushdns on Windows)");
console.error("  4. Restart with: npm run start  (loads .env.local automatically)");
process.exit(1);