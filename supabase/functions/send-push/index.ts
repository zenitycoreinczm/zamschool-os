/**
 * Supabase Edge Function: send-push
 *
 * Looks up Expo tokens in `user_devices` and POSTs to Expo Push API.
 * Deploy: `supabase functions deploy send-push`
 *
 * Auth:
 *  - Service role bearer OR x-push-secret (Cloudflare workers / queues)
 *  - Signed-in user JWT may fan out to school-scoped recipients only
 *    (messages, roll-call, results). Tokens are resolved with service role.
 *
 * Security (Phase 0.1):
 *  - Broadcast restricted to BROADCAST_ROLES
 *  - Explicit userIds filtered to caller's school_id
 *  - Raw tokens forbidden for non-service callers
 *  - Constant-time secret compare
 *  - Per-user rate limiting
 *  - Audit log on every dispatch
 *
 * Body:
 * {
 *   "userIds": ["uuid"],
 *   "tokens": ["ExponentPushToken[...]"],  // service only
 *   "title": "...",
 *   "body": "...",
 *   "data": { "type": "ATTENDANCE", "tab": "attendance", ... },
 *   "type": "ATTENDANCE",
 *   "referenceId": "...",
 *   "persist": true,
 *   "schoolId": null,
 *   "targetRole": "parent" | null,
 *   "broadcastSchool": false
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-push-secret',
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const EXPO_CHUNK_SIZE = 100
const MAX_RECIPIENTS_USER = 200
const MAX_RECIPIENTS_SERVICE = 5000
const MAX_RECIPIENTS_PEER = 5

/** Sliding-window rate limit: max dispatches per user per window. */
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60_000

/** In-memory per-isolate rate buckets (resets on cold start — defence in depth). */
const rateBuckets = new Map<string, number[]>()

const STAFF_ROLES = new Set([
  'teacher',
  'class_teacher',
  'admin',
  'principal',
  'deputy_head',
  'academic_admin',
  'bursar',
  'hr_admin',
  'ict_admin',
  'discipline_admin',
  'registrar',
  'super_admin',
  'system_owner',
  'school_admin',
])

/** Decode JWT payload without verify (role / ref only). */
function peekJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return null
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

/** Length-independent constant-time string comparison for shared secrets. */
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(String(a || ''))
  const bBytes = new TextEncoder().encode(String(b || ''))
  // Compare against max length so mismatched lengths still run full loop.
  const length = Math.max(aBytes.length, bBytes.length)
  let diff = aBytes.length ^ bBytes.length
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0)
  }
  return diff === 0
}

// School-wide broadcast is an administrative action. Peer roles (parent,
// student) and rank-and-file staff may target explicit recipients only.
const BROADCAST_ROLES = new Set([
  'admin',
  'school_admin',
  'principal',
  'deputy_head',
  'academic_admin',
  'registrar',
  'super_admin',
  'system_owner',
])

function isServiceRoleToken(token: string, serviceKey: string): boolean {
  if (!token) return false
  if (serviceKey && timingSafeEqual(token, serviceKey)) return true
  const payload = peekJwtPayload(token)
  return String(payload?.role || '') === 'service_role'
}

function canBroadcast(role: string | null | undefined): boolean {
  return BROADCAST_ROLES.has(String(role || '').toLowerCase())
}

function maxRecipientsFor(
  isService: boolean,
  broadcastAll: boolean,
  role: string | null | undefined
): number {
  if (isService || broadcastAll) return MAX_RECIPIENTS_SERVICE
  if (STAFF_ROLES.has(String(role || '').toLowerCase())) return MAX_RECIPIENTS_USER
  return MAX_RECIPIENTS_PEER
}

/**
 * Returns true if the caller is over the per-user rate limit.
 * Service-role callers are never rate-limited here.
 */
function isRateLimited(userId: string, now = Date.now()): boolean {
  const key = String(userId || '')
  if (!key) return false
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const prev = (rateBuckets.get(key) || []).filter((t) => t > cutoff)
  if (prev.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(key, prev)
    return true
  }
  prev.push(now)
  rateBuckets.set(key, prev)
  return false
}

async function writeAuditLog(
  admin: ReturnType<typeof createClient>,
  entry: Record<string, unknown>
): Promise<void> {
  const payload = {
    ...entry,
    created_at: new Date().toISOString(),
  }
  try {
    // Prefer a dedicated audit table when present; fall back to console.
    const { error } = await admin.from('push_dispatch_audit').insert(payload)
    if (error) {
      console.log('[send-push audit]', JSON.stringify(payload), error.message)
    }
  } catch {
    console.log('[send-push audit]', JSON.stringify(payload))
  }
}

type PushRequest = {
  userIds?: string[]
  tokens?: string[]
  title: string
  body: string
  data?: Record<string, unknown>
  persist?: boolean
  schoolId?: string | null
  type?: string
  referenceId?: string | null
  sound?: string
  channelId?: string
  priority?: 'default' | 'normal' | 'high'
  targetRole?: string | null
  broadcastSchool?: boolean
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function uniqueStrings(values: unknown[]): string[] {
  return [
    ...new Set(
      (values || [])
        .map((v) => (v == null ? '' : String(v).trim()))
        .filter(Boolean)
    ),
  ]
}

async function sendExpoPush(
  messages: Array<Record<string, unknown>>
): Promise<{ tickets: unknown[]; deadTokens: string[]; errors: string[] }> {
  const tickets: unknown[] = []
  const deadTokens: string[] = []
  const errors: string[] = []

  for (const batch of chunk(messages, EXPO_CHUNK_SIZE)) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        errors.push(`Expo HTTP ${res.status}: ${JSON.stringify(payload).slice(0, 200)}`)
        continue
      }
      const data = Array.isArray(payload?.data) ? payload.data : [payload?.data]
      for (let i = 0; i < data.length; i++) {
        const ticket = data[i]
        if (!ticket) continue
        tickets.push(ticket)
        if (
          ticket?.status === 'error' &&
          ticket?.details?.error === 'DeviceNotRegistered'
        ) {
          const to = batch[i]?.to
          if (typeof to === 'string') deadTokens.push(to)
          errors.push(`DeviceNotRegistered`)
        }
      }
    } catch (e) {
      errors.push(String((e as Error)?.message || e))
    }
  }

  return { tickets, deadTokens, errors }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const workerSecret = Deno.env.get('PUSH_WORKER_SECRET') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: 'Supabase env not configured' })
    }

    const authHeader = req.headers.get('authorization') || ''
    const pushSecret = req.headers.get('x-push-secret') || ''
    const apiKeyHeader = req.headers.get('apikey') || ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()

    // Accept service role via Authorization, apikey, worker secret, or JWT role claim.
    const isService =
      (workerSecret && timingSafeEqual(pushSecret, workerSecret)) ||
      isServiceRoleToken(bearer, serviceKey) ||
      isServiceRoleToken(apiKeyHeader, serviceKey)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let callerUserId: string | null = null
    let callerRole: string | null = null
    let callerSchoolId: string | null = null

    if (!isService) {
      if (!bearer) {
        return json(401, { error: 'Unauthorized' })
      }

      // Prefer admin.getUser(jwt) — reliable for mobile supabase.functions.invoke sessions.
      let userId: string | null = null
      const { data: byJwt, error: jwtErr } = await admin.auth.getUser(bearer)
      if (!jwtErr && byJwt?.user?.id) {
        userId = byJwt.user.id
      } else if (anonKey) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { data: userData, error: userError } = await userClient.auth.getUser()
        if (!userError && userData?.user?.id) {
          userId = userData.user.id
        }
      }

      if (!userId) {
        return json(401, {
          error: 'Invalid user token',
          detail: jwtErr?.message || 'Sign in again and retry push.',
        })
      }
      callerUserId = userId

      // Resolve profile by auth uid, profiles.id, or auth_user_id column variants.
      const profileAttempts = [
        () =>
          admin
            .from('profiles')
            .select('id, role, school_id')
            .eq('id', callerUserId)
            .maybeSingle(),
        () =>
          admin
            .from('profiles')
            .select('id, role, school_id')
            .eq('auth_user_id', callerUserId)
            .maybeSingle(),
        () =>
          admin
            .from('profiles')
            .select('id, role, school_id')
            .eq('user_id', callerUserId)
            .maybeSingle(),
      ]

      for (const run of profileAttempts) {
        try {
          const { data: profile, error } = await run()
          if (!error && profile) {
            callerRole = profile?.role ? String(profile.role).toLowerCase() : null
            callerSchoolId = profile?.school_id ? String(profile.school_id) : null
            break
          }
        } catch {
          // try next shape
        }
      }
    }

    // Per-user rate limit (non-service only).
    if (!isService && callerUserId && isRateLimited(callerUserId)) {
      return json(429, {
        error: 'Too many push requests. Try again in a minute.',
      })
    }

    const body = (await req.json()) as PushRequest
    const title = String(body.title || '').trim()
    const messageBody = String(body.body || '').trim()
    if (!title || !messageBody) {
      return json(400, { error: 'title and body are required' })
    }

    let userIds = uniqueStrings(body.userIds || [])
    // Raw push tokens bypass all school-scope checks, so only trusted
    // service-role callers (workers/queues) may supply them directly.
    let tokens = isService ? uniqueStrings(body.tokens || []) : []
    if (!isService && Array.isArray(body.tokens) && body.tokens.length) {
      return json(403, { error: 'Raw push tokens are not permitted for user requests' })
    }

    const targetRole = body.targetRole ? String(body.targetRole).toLowerCase() : null
    // Non-service callers never trust client-supplied schoolId — always use profile.
    const schoolId = isService
      ? body.schoolId || callerSchoolId || null
      : callerSchoolId || null
    const broadcastAll =
      body.broadcastSchool === true ||
      targetRole === 'all' ||
      targetRole === '*' ||
      targetRole === 'everyone'

    // School-wide broadcast is restricted to administrative roles. Service-role
    // callers (announcements pipeline) remain trusted.
    if (broadcastAll && !isService && !canBroadcast(callerRole)) {
      return json(403, { error: 'Not permitted to broadcast school-wide' })
    }

    // Non-service callers without a school cannot fan out (except empty → 400 later).
    if (!isService && !schoolId && (broadcastAll || targetRole || userIds.length)) {
      return json(403, {
        error: 'Caller profile is missing school_id; cannot dispatch notifications',
      })
    }

    // Expand audience by role or entire school (announcements / events).
    if ((broadcastAll || targetRole) && (isService || schoolId)) {
      let query = admin
        .from('profiles')
        .select('id, user_id, auth_user_id, role')
        .limit(5000)
      if (!isService && schoolId) {
        query = query.eq('school_id', schoolId)
      } else if (isService && body.schoolId) {
        query = query.eq('school_id', body.schoolId)
      }
      if (!broadcastAll && targetRole) {
        query = query.eq('role', targetRole)
      }
      const { data: roleUsers } = await query
      for (const row of roleUsers || []) {
        if (row?.id) userIds.push(String(row.id))
        if (row?.user_id) userIds.push(String(row.user_id))
        if (row?.auth_user_id) userIds.push(String(row.auth_user_id))
      }
      userIds = uniqueStrings(userIds)
    }

    // Explicit userIds from non-service callers must belong to the caller school.
    // This blocks cross-school harassment via forged recipient lists.
    if (!isService && userIds.length && schoolId) {
      const candidateIds = uniqueStrings(userIds).slice(0, 500)
      const schoolScoped = new Set<string>()

      const [byId, byAuth, byUser] = await Promise.all([
        admin
          .from('profiles')
          .select('id, auth_user_id, user_id, school_id')
          .in('id', candidateIds)
          .eq('school_id', schoolId),
        admin
          .from('profiles')
          .select('id, auth_user_id, user_id, school_id')
          .in('auth_user_id', candidateIds)
          .eq('school_id', schoolId),
        admin
          .from('profiles')
          .select('id, auth_user_id, user_id, school_id')
          .in('user_id', candidateIds)
          .eq('school_id', schoolId),
      ])

      for (const row of [
        ...(byId.data || []),
        ...(byAuth.data || []),
        ...(byUser.data || []),
      ]) {
        if (row?.id) schoolScoped.add(String(row.id))
        if (row?.auth_user_id) schoolScoped.add(String(row.auth_user_id))
        if (row?.user_id) schoolScoped.add(String(row.user_id))
      }

      const filtered = candidateIds.filter((id) => schoolScoped.has(id))
      if (!filtered.length && candidateIds.length) {
        return json(403, {
          error: 'No recipients belong to your school',
        })
      }
      // Reject if any requested id was outside the school (strict mode).
      const rejected = candidateIds.filter((id) => !schoolScoped.has(id))
      if (rejected.length) {
        return json(403, {
          error: 'One or more recipients are outside your school',
          rejectedCount: rejected.length,
        })
      }
      userIds = filtered
    }

    if (!userIds.length && !tokens.length) {
      return json(400, {
        error: 'Provide userIds, tokens, targetRole, or broadcastSchool',
      })
    }

    const maxRecipients = maxRecipientsFor(isService, broadcastAll, callerRole)
    if (userIds.length > maxRecipients) {
      userIds = userIds.slice(0, maxRecipients)
    }

    // Expand profile ids ↔ auth user ids so user_devices (auth.users.id) matches.
    // For non-service callers, re-assert school_id on every expansion row.
    if (userIds.length) {
      const lookupKeys = uniqueStrings(userIds).slice(0, 500)
      let byIdQuery = admin
        .from('profiles')
        .select('id, auth_user_id, user_id')
        .in('id', lookupKeys)
      let byAuthQuery = admin
        .from('profiles')
        .select('id, auth_user_id, user_id')
        .in('auth_user_id', lookupKeys)
      if (!isService && schoolId) {
        byIdQuery = byIdQuery.eq('school_id', schoolId)
        byAuthQuery = byAuthQuery.eq('school_id', schoolId)
      }
      const [byId, byAuth] = await Promise.all([byIdQuery, byAuthQuery])
      for (const row of [...(byId.data || []), ...(byAuth.data || [])]) {
        if (row?.id) userIds.push(String(row.id))
        if (row?.auth_user_id) userIds.push(String(row.auth_user_id))
        if (row?.user_id) userIds.push(String(row.user_id))
      }
      userIds = uniqueStrings(userIds)
    }

    // Resolve tokens from user_devices (user_id may be auth uid or profile id).
    if (userIds.length) {
      const { data: byUserId, error: e1 } = await admin
        .from('user_devices')
        .select('push_token, user_id')
        .in('user_id', userIds)

      if (e1) {
        return json(500, { error: `user_devices lookup failed: ${e1.message}` })
      }
      for (const row of byUserId || []) {
        if (row?.push_token) tokens.push(String(row.push_token))
      }
    }

    tokens = uniqueStrings(tokens)

    const auditBase = {
      caller_id: callerUserId,
      caller_role: callerRole,
      school_id: schoolId,
      broadcast: broadcastAll,
      recipient_count: Math.max(userIds.length, tokens.length),
      notification_type: String(body.type || body.data?.type || 'GENERAL'),
      is_service: isService,
      title: title.slice(0, 120),
    }

    if (!tokens.length) {
      await writeAuditLog(admin, {
        ...auditBase,
        result: 'no_tokens',
        sent: 0,
      })
      return json(200, {
        sent: 0,
        message:
          'No device tokens in user_devices for these users. Recipients must open the app once with notifications enabled.',
        tickets: [],
        userIds,
      })
    }

    const data = {
      ...(body.data && typeof body.data === 'object' ? body.data : {}),
      type: body.type || body.data?.type || 'GENERAL',
      referenceId: body.referenceId ?? body.data?.referenceId ?? null,
    }

    const messages = tokens.map((to) => ({
      to,
      title,
      body: messageBody,
      sound: body.sound || 'default',
      priority: body.priority || 'high',
      channelId: body.channelId || 'default',
      data,
    }))

    const { tickets, deadTokens, errors } = await sendExpoPush(messages)

    if (deadTokens.length) {
      await admin.from('user_devices').delete().in('push_token', deadTokens)
    }

    // Persist in-app notification feed when requested.
    if (body.persist !== false && userIds.length) {
      const rows = userIds.map((recipient_id) => ({
        school_id: schoolId,
        recipient_id,
        title,
        message: messageBody,
        type: String(body.type || data.type || 'GENERAL'),
        reference_id: body.referenceId != null ? String(body.referenceId) : null,
        read: false,
      }))
      const { error: insertError } = await admin.from('notifications').insert(rows)
      if (insertError) {
        // recipient_id may reference auth.users only — soft-fail feed insert.
        errors.push(`notifications insert: ${insertError.message}`)
      }
    }

    await writeAuditLog(admin, {
      ...auditBase,
      result: 'ok',
      sent: tokens.length,
      dead_tokens: deadTokens.length,
      error_count: errors.length,
    })

    return json(200, {
      sent: tokens.length,
      tickets,
      errors,
      deadTokensRemoved: deadTokens.length,
      callerUserId,
    })
  } catch (e) {
    return json(500, { error: String((e as Error)?.message || e) })
  }
})
