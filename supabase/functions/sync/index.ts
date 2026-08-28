import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tables a client is allowed to push local changes into via this endpoint.
// This runs with the SERVICE ROLE KEY (bypasses RLS), so this allow-list is
// the *only* thing stopping a forged request from writing to arbitrary
// tables. `profiles` is intentionally excluded: profile edits go through the
// dedicated /api/auth/profile REST endpoint, never blind sync push, because
// it carries sensitive fields (role, school_id).
const PUSHABLE_TABLES = new Set([
  'students',
  'attendance',
  'payments',
  'fee_structures',
  'grades',
  'subjects',
  'exam_sessions',
  'certificates',
])

// Which roles may write to each pushable table. school_id scoping (above)
// stops cross-tenant tampering; this stops in-tenant privilege abuse, e.g. a
// student or parent account pushing their own attendance/grades/payments.
// Tables not listed here have no extra role restriction beyond the school
// scoping already enforced everywhere.
const WRITE_ROLES_BY_TABLE: Record<string, string[]> = {
  attendance: ['teacher', 'principal', 'academic_admin', 'admin', 'super_admin'],
  grades: ['teacher', 'academic_admin', 'principal', 'admin', 'super_admin'],
  payments: ['bursar', 'principal', 'admin', 'super_admin'],
  fee_structures: ['bursar', 'principal', 'admin', 'super_admin'],
  subjects: ['academic_admin', 'ict_admin', 'principal', 'admin', 'super_admin'],
  exam_sessions: ['academic_admin', 'principal', 'admin', 'super_admin'],
  certificates: ['principal', 'academic_admin', 'admin', 'super_admin'],
  students: ['academic_admin', 'hr_admin', 'principal', 'admin', 'super_admin'],
}

// Tables where the client's write always wins regardless of server last_modified.
// Attendance is marked once per student per lesson by the class teacher; a
// correction from an offline device should overwrite a stale server value.
const LAST_WRITER_WINS_TABLES = new Set(['attendance'])

function canWriteTable(tableName: string, role: string | null | undefined): boolean {
  const allowedRoles = WRITE_ROLES_BY_TABLE[tableName]
  if (!allowedRoles) return true
  return allowedRoles.includes(String(role || ''))
}

// Columns a client can never set directly — always derived server-side from
// the authenticated user's profile, never trusted from the request body.
const SERVER_OWNED_COLUMNS = ['school_id', 'last_modified']

function stripServerOwnedColumns(data: Record<string, unknown>) {
  const clean = { ...data }
  for (const column of SERVER_OWNED_COLUMNS) {
    delete clean[column]
  }
  return clean
}

type Conflict = Record<string, unknown>

/** Pull rows changed since `sinceMs` for one table, tolerating tables whose schema doesn't match the guess below. */
async function pullTable(
  supabaseClient: SupabaseClient,
  table: string,
  schoolId: string | null,
  sinceMs: number,
  mapRow: (row: any) => Record<string, unknown>
) {
  try {
    let query = supabaseClient.from(table).select('*').gt('last_modified', sinceMs)
    if (schoolId) {
      query = query.eq('school_id', schoolId)
    }
    const { data, error } = await query
    if (error) {
      console.error(`[sync] Pull error for ${table}:`, error.message)
      return []
    }
    return (data || []).map(mapRow)
  } catch (error) {
    console.error(`[sync] Pull threw for ${table}:`, error)
    return []
  }
}

// Sync endpoint for WatermelonDB
// Handles both pull (get changes since last sync) and push (apply local changes)
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { last_pulled_at, changes } = await req.json()
    const lastPulledAtMs = Number(last_pulled_at) || 0

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get user from JWT
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's school_id for filtering
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('school_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const schoolId = profile.school_id ?? null
    const timestamp = Date.now()

    // If changes provided, this is a PUSH request
    if (changes) {
      const conflicts: Conflict[] = []

      for (const [tableName, tableChanges] of Object.entries(changes)) {
        const { created = [], updated = [], deleted = [] } = tableChanges as any

        // Reject writes to any table that isn't explicitly allow-listed —
        // WatermelonDB auto-tracks dirty rows across every registered local
        // model (including device-only tables like offline_queue,
        // sync_metadata, attendance_drafts, crash_recovery), and a forged
        // request could name any table at all. Never trust the table name.
        if (!PUSHABLE_TABLES.has(tableName)) {
          for (const record of [...created, ...updated]) {
            conflicts.push({ table: tableName, id: record?.id, error: 'Table is not sync-writable' })
          }
          for (const id of deleted) {
            conflicts.push({ table: tableName, id, error: 'Table is not sync-writable' })
          }
          continue
        }

        if (!canWriteTable(tableName, profile.role)) {
          for (const record of [...created, ...updated]) {
            conflicts.push({ table: tableName, id: record?.id, error: 'Your role cannot modify this table' })
          }
          for (const id of deleted) {
            conflicts.push({ table: tableName, id, error: 'Your role cannot modify this table' })
          }
          continue
        }

        // Handle creates
        for (const record of created) {
          const { id, ...rest } = record
          const data = stripServerOwnedColumns(rest)

          // Guard against an id collision with a row owned by a different
          // school — without this check, upsert would silently overwrite
          // another tenant's data.
          const { data: existingRow } = await supabaseClient
            .from(tableName)
            .select('school_id')
            .eq('id', id)
            .maybeSingle()

          if (existingRow && existingRow.school_id !== schoolId) {
            conflicts.push({ table: tableName, id, error: 'Record belongs to a different school' })
            continue
          }

          const { error } = await supabaseClient
            .from(tableName)
            .upsert({
              ...data,
              id,
              school_id: schoolId,
              last_modified: timestamp,
            })

          if (error) {
            console.error(`[sync] Error creating ${tableName}:`, error)
            conflicts.push({ table: tableName, id, error: error.message })
          }
        }

        // Handle updates
        for (const record of updated) {
          const { id, ...rest } = record
          const data = stripServerOwnedColumns(rest)

          const { data: existing } = await supabaseClient
            .from(tableName)
            .select('last_modified, school_id')
            .eq('id', id)
            .maybeSingle()

          if (!existing || existing.school_id !== schoolId) {
            conflicts.push({ table: tableName, id, error: 'Record not found in your school' })
            continue
          }

          // Last-writer-wins tables skip the staleness check — the client's
          // correction is always applied as long as it belongs to this school.
          if (!LAST_WRITER_WINS_TABLES.has(tableName) && existing.last_modified > lastPulledAtMs) {
            conflicts.push({
              table: tableName,
              id,
              serverVersion: existing,
              clientVersion: record,
            })
            continue
          }

          // school_id filter here is defense in depth: it's already verified
          // above, but keeps the update scoped even if that check is ever
          // changed later.
          const { error } = await supabaseClient
            .from(tableName)
            .update({ ...data, last_modified: timestamp })
            .eq('id', id)
            .eq('school_id', schoolId)

          if (error) {
            console.error(`[sync] Error updating ${tableName}:`, error)
            conflicts.push({ table: tableName, id, error: error.message })
          }
        }

        // Handle deletes
        for (const id of deleted) {
          const { error } = await supabaseClient
            .from(tableName)
            .delete()
            .eq('id', id)
            .eq('school_id', schoolId)

          if (error) {
            console.error(`[sync] Error deleting ${tableName}:`, error)
            conflicts.push({ table: tableName, id, error: error.message })
          }
        }
      }

      return new Response(
        JSON.stringify({
          timestamp,
          conflicts: conflicts.length > 0 ? conflicts : undefined
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Otherwise this is a PULL request. Each table is fetched independently
    // so a schema mismatch or missing column on one table can't take down
    // the rest of the sync.
    const [profiles, students, attendance, payments, feeStructures, grades, subjects, examSessions, certificates] =
      await Promise.all([
        pullTable(supabaseClient, 'profiles', schoolId, lastPulledAtMs, (p) => ({
          id: p.id,
          remote_id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          role: p.role,
          school_id: p.school_id,
          email: p.email,
          avatar_url: p.avatar_url,
          last_synced_at: timestamp,
        })),
        pullTable(supabaseClient, 'students', schoolId, lastPulledAtMs, (s) => ({
          id: s.id,
          remote_id: s.id,
          profile_id: s.profile_id,
          grade_id: s.grade_id,
          student_id_number: s.student_id_number,
          enrollment_status: s.enrollment_status,
          last_synced_at: timestamp,
        })),
        pullTable(supabaseClient, 'attendance', schoolId, lastPulledAtMs, (a) => ({
          id: a.id,
          remote_id: a.id,
          student_id: a.student_id,
          date: a.date,
          status: a.status,
          marked_by: a.marked_by,
          marked_at: a.marked_at,
          sync_status: 'synced',
          last_synced_at: timestamp,
        })),
        pullTable(supabaseClient, 'payments', schoolId, lastPulledAtMs, (p) => ({
          id: p.id,
          remote_id: p.id,
          student_id: p.student_id,
          amount: p.amount,
          method: p.method,
          receipt_number: p.receipt_number,
          recorded_by: p.recorded_by,
          recorded_at: p.recorded_at,
          sync_status: 'synced',
          last_synced_at: timestamp,
        })),
        pullTable(supabaseClient, 'fee_structures', schoolId, lastPulledAtMs, (f) => ({
          id: f.id,
          remote_id: f.id,
          grade_id: f.grade_id,
          term: f.term,
          amount: f.amount,
          description: f.description,
          last_synced_at: timestamp,
        })),
        pullTable(supabaseClient, 'grades', schoolId, lastPulledAtMs, (g) => ({
          id: g.id,
          remote_id: g.id,
          student_id: g.student_id,
          subject_id: g.subject_id,
          exam_id: g.exam_id,
          score: g.score,
          grade_symbol: g.grade_symbol,
          entered_by: g.entered_by,
          entered_at: g.entered_at,
          sync_status: 'synced',
          last_synced_at: timestamp,
        })),
        pullTable(supabaseClient, 'subjects', schoolId, lastPulledAtMs, (s) => ({
          id: s.id,
          remote_id: s.id,
          name: s.name,
          code: s.code,
          school_id: s.school_id,
          last_synced_at: timestamp,
        })),
        pullTable(supabaseClient, 'exam_sessions', schoolId, lastPulledAtMs, (e) => ({
          id: e.id,
          remote_id: e.id,
          name: e.name,
          grade_id: e.grade_id,
          term: e.term,
          year: e.year,
          status: e.status,
          created_by: e.created_by,
          created_at: e.created_at,
          last_synced_at: timestamp,
        })),
        pullTable(supabaseClient, 'certificates', schoolId, lastPulledAtMs, (c) => ({
          id: c.id,
          remote_id: c.id,
          certificate_number: c.certificate_number,
          type: c.type,
          title: c.title,
          student_id: c.student_id,
          student_name: c.student_name,
          student_admission_number: c.student_admission_number,
          description: c.description,
          issue_date: c.issue_date,
          expiry_date: c.expiry_date,
          issuer_id: c.issuer_id,
          issuer_name: c.issuer_name,
          issuer_title: c.issuer_title,
          school_name: c.school_name,
          details_json: c.details_json,
          status: c.status,
          sync_status: 'synced',
          created_at: c.created_at,
          updated_at: c.updated_at,
          last_synced_at: timestamp,
        })),
      ])

    const empty = { created: [], updated: [], deleted: [] }
    const syncChanges = {
      profiles: { ...empty, created: profiles },
      students: { ...empty, created: students },
      attendance: { ...empty, created: attendance },
      payments: { ...empty, created: payments },
      fee_structures: { ...empty, created: feeStructures },
      grades: { ...empty, created: grades },
      subjects: { ...empty, created: subjects },
      exam_sessions: { ...empty, created: examSessions },
      certificates: { ...empty, created: certificates },
    }

    return new Response(
      JSON.stringify({
        changes: syncChanges,
        timestamp
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[sync] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
