/**
 * Cloudflare connection status + next steps for ZamSchool.
 * Usage: node --env-file=.env.local scripts/connect-cloudflare.mjs
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const gatewayDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'workers', 'gateway');

const checks = [];
function ok(label, detail) {
  checks.push({ ok: true, label, detail });
}
function fail(label, detail) {
  checks.push({ ok: false, label, detail });
}

const accountId = process.env.CF_ACCOUNT_ID;
const apiToken = process.env.CF_API_TOKEN;
const r2Endpoint = process.env.R2_ENDPOINT;
const r2Key = process.env.R2_ACCESS_KEY_ID;
const r2Secret = process.env.R2_SECRET_ACCESS_KEY;
const publicUrl = (process.env.R2_PUBLIC_URL || '').trim();
const kvUrl = process.env.KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN;

// --- R2 S3 API (object storage) ---
if (r2Endpoint && r2Key && r2Secret) {
  try {
    const { uploadFile, getPublicUrl } = await import('../lib/r2-client.ts');
    const key = `test/connect/${Date.now()}.txt`;
    await uploadFile(key, Buffer.from('ok'), { bucket: 'assets', contentType: 'text/plain' });
    const url = getPublicUrl(key, 'assets');
    ok('R2 S3 API (upload)', `Credentials work. Sample URL: ${url}`);
    if (!publicUrl) {
      fail('R2 public CDN URL', 'R2_PUBLIC_URL unset - avatars use /api/public/assets proxy (slower).');
    } else if (url.startsWith(publicUrl.replace(/\/+$/, ''))) {
      ok('R2 public CDN URL', publicUrl);
    } else {
      fail('R2 public CDN URL', `R2_PUBLIC_URL=${publicUrl} but getPublicUrl returned ${url}`);
    }
  } catch (e) {
    fail('R2 S3 API', e instanceof Error ? e.message : String(e));
  }
} else {
  fail('R2 S3 API', 'Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.local');
}

// --- Cloudflare REST API token ---
if (!accountId || !apiToken) {
  fail('CF API token', 'Set CF_ACCOUNT_ID and CF_API_TOKEN in .env.local');
} else {
  const verify = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  const vJson = await verify.json().catch(() => ({}));
  if (verify.ok && vJson.success) {
    ok('CF API token (valid)', 'Token is recognized by Cloudflare');
  } else {
    fail('CF API token', vJson.errors?.[0]?.message || `HTTP ${verify.status}`);
  }

  const buckets = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );
  const bJson = await buckets.json().catch(() => ({}));
  if (buckets.ok && bJson.success) {
    const names = (bJson.result?.buckets || []).map((b) => b.name).join(', ');
    ok('CF API R2 permissions', names || '(no buckets)');
  } else {
    const err = bJson.errors?.[0];
    const code = err?.code;
    const msg = err?.message || `HTTP ${buckets.status}`;
    if (code === 9109) {
      fail(
        'CF API R2 permissions',
        `${msg} - add your current IP to the token allowlist in Cloudflare Dashboard → My Profile → API Tokens.`
      );
    } else {
      fail(
        'CF API R2 permissions',
        `${msg} - create a token with Account → R2 → Read (and Workers if deploying gateway).`
      );
    }
  }
}

// --- KV REST (optional) ---
if (kvUrl && kvToken) {
  try {
    const probe = `connect-probe-${Date.now()}`;
    const put = await fetch(`${kvUrl}/values/${encodeURIComponent(probe)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${kvToken}`, 'Expiration-TTL': '60' },
      body: '1',
    });
    if (put.ok) ok('KV REST API', kvUrl);
    else fail('KV REST API', `PUT failed HTTP ${put.status}`);
  } catch (e) {
    fail('KV REST API', e instanceof Error ? e.message : String(e));
  }
} else {
  checks.push({ ok: null, label: 'KV REST API', detail: 'Skipped (KV_REST_* not set)' });
}

// --- Wrangler CLI ---
const wr = spawnSync('npx', ['wrangler', 'whoami'], {
  cwd: gatewayDir,
  shell: true,
  encoding: 'utf8',
  env: {
    ...process.env,
    CLOUDFLARE_API_TOKEN: apiToken || '',
    CLOUDFLARE_ACCOUNT_ID: accountId || '',
  },
});
const whoami = (wr.stdout || '') + (wr.stderr || '');
if (whoami.includes('You are logged in') || whoami.includes('@')) {
  ok('Wrangler auth', 'Logged in or API token accepted');
} else if (whoami.includes('not authenticated')) {
  fail('Wrangler auth', 'Run: cd workers/gateway && npx wrangler login');
} else if (whoami.includes('9109') || whoami.includes('location')) {
  fail('Wrangler auth', 'API token IP allowlist blocks this machine - update token in dashboard');
} else if (whoami.includes('10000') || whoami.includes('Authentication error')) {
  fail('Wrangler auth', 'Token lacks permissions - use R2 Read + Workers Scripts Edit for gateway deploy');
} else {
  fail('Wrangler auth', whoami.trim().split('\n').slice(-3).join(' ') || 'unknown');
}

console.log('\n=== ZamSchool Cloudflare connection ===\n');
for (const c of checks) {
  const icon = c.ok === true ? '✓' : c.ok === false ? '✗' : '○';
  console.log(`${icon} ${c.label}`);
  console.log(`  ${c.detail}\n`);
}

const blockers = checks.filter((c) => c.ok === false);
if (blockers.length === 0) {
  console.log('All checks passed. Optional: deploy gateway with cd workers/gateway && npx wrangler deploy');
  process.exit(0);
}

console.log('--- Fix these in Cloudflare Dashboard ---\n');
console.log('1. R2 public URL (avatars & CDN):');
console.log('   R2 → zamschool-assets → Settings → Public Development URL → Enable');
console.log('   Copy URL into .env.local:');
console.log('   R2_PUBLIC_URL=https://pub-xxxx.r2.dev');
console.log('   NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxxx.r2.dev\n');
console.log('2. API token (for wrangler + discover script):');
console.log('   My Profile → API Tokens → Create → R2 Read + Workers (if deploying gateway)');
console.log('   Include this machine IP in allowlist (or no IP filter for dev)\n');
console.log('3. Wrangler login (interactive):');
console.log('   cd workers/gateway && npx wrangler login\n');
console.log('Then re-run: npm run cloudflare:status\n');

process.exit(1);