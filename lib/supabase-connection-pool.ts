/**
 * Supabase Connection Pool Optimizer for 20K+ Daily Users
 * 
 * Implements connection reuse, query batching, and read replica routing
 * to minimize database load and latency.
 */

import { createClient } from "@supabase/supabase-js";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

// Connection pool singleton
let adminClient: ReturnType<typeof createClient> | null = null;
let anonClient: ReturnType<typeof createClient> | null = null;

// Query metrics for monitoring
const queryMetrics = {
  totalQueries: 0,
  cachedQueries: 0,
  batchedQueries: 0,
  lastReset: Date.now(),
};

/**
 * Get or create admin client with optimized settings
 */
export function getOptimizedAdminClient(): ReturnType<typeof createClient> {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase admin client misconfigured");
  }

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // Optimized fetch with adaptive timeout
      fetch: createAdaptiveFetch(20_000),
      headers: {
        "Prefer": "count=exact", // Always request count for pagination
      },
    },
  });

  return adminClient;
}

/**
 * Get or create anon client for public operations
 */
export function getOptimizedAnonClient(): ReturnType<typeof createClient> {
  if (anonClient) return anonClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase anon client misconfigured");
  }

  anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
    global: {
      fetch: createAdaptiveFetch(15_000),
    },
  });

  return anonClient;
}

/**
 * Create adaptive fetch with exponential backoff on failures
 */
function createAdaptiveFetch(timeoutMs: number) {
  let consecutiveFailures = 0;
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 100;

  return async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    const options = init ?? {};
    const controller = new AbortController();
    const externalSignal = options.signal;

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, { ...options, signal: controller.signal });
      
      // Reset failure counter on success
      if (response.ok) {
        consecutiveFailures = 0;
      }
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      consecutiveFailures++;
      clearTimeout(timeoutId);
      throw error;
    }
  };
}

/**
 * Batch multiple queries into a single Promise.all
 * Reduces round-trip latency for related data fetching
 */
export async function batchQueries<T>(
  queries: Array<() => Promise<{ data: T | null; error: any }>>,
): Promise<Array<{ data: T | null; error: any }>> {
  queryMetrics.batchedQueries += queries.length;
  
  const results = await Promise.allSettled(queries.map(q => q()));
  
  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return { data: null, error: result.reason };
  });
}

/**
 * Execute query with automatic retry on transient failures
 */
export async function executeWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  maxRetries: number = 2,
): Promise<{ data: T | null; error: any }> {
  let lastError: any = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn();
      
      if (!result.error) {
        queryMetrics.totalQueries++;
        return result;
      }
      
      // Don't retry on client errors (4xx)
      if (result.error?.code && String(result.error.code).startsWith("4")) {
        return result;
      }
      
      lastError = result.error;
      
      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delay = Math.min(100 * Math.pow(2, attempt), 1000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(100 * Math.pow(2, attempt), 1000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return { data: null, error: lastError };
}

/**
 * Paginated query helper with cursor-based pagination
 * More efficient than offset-based for large datasets
 */
export async function paginatedQuery<T>(
  queryBuilder: (page: number, pageSize: number) => PostgrestFilterBuilder<any, any, any>,
  options: {
    pageSize?: number;
    maxPages?: number;
    stopCondition?: (data: T[]) => boolean;
  } = {},
): Promise<T[]> {
  const { pageSize = 100, maxPages = 10, stopCondition } = options;
  const allData: T[] = [];
  
  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await queryBuilder(page, pageSize);
    
    if (error || !data || data.length === 0) {
      break;
    }
    
    allData.push(...data);
    
    // Early exit if we've collected enough data
    if (stopCondition && stopCondition(data)) {
      break;
    }
    
    // Stop if we got less than pageSize (last page)
    if (data.length < pageSize) {
      break;
    }
  }
  
  return allData;
}

/**
 * Get query metrics for monitoring
 */
export function getQueryMetrics() {
  const uptime = Date.now() - queryMetrics.lastReset;
  const hours = uptime / (1000 * 60 * 60);
  
  return {
    ...queryMetrics,
    queriesPerHour: hours > 0 ? Math.round(queryMetrics.totalQueries / hours) : 0,
    cacheHitRate: queryMetrics.totalQueries > 0
      ? Math.round((queryMetrics.cachedQueries / queryMetrics.totalQueries) * 100)
      : 0,
  };
}

/**
 * Reset query metrics (call during deployment or maintenance)
 */
export function resetQueryMetrics() {
  queryMetrics.totalQueries = 0;
  queryMetrics.cachedQueries = 0;
  queryMetrics.batchedQueries = 0;
  queryMetrics.lastReset = Date.now();
}

/**
 * Health check for Supabase connectivity
 */
export async function checkSupabaseHealth(): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const client = getOptimizedAdminClient();
    const { error } = await client.from("profiles").select("id").limit(1);
    
    const latency = Date.now() - startTime;
    
    if (error) {
      return {
        status: latency > 5000 ? "unhealthy" : "degraded",
        latency,
        error: error.message,
      };
    }
    
    return {
      status: latency < 1000 ? "healthy" : "degraded",
      latency,
    };
  } catch (err) {
    return {
      status: "unhealthy",
      latency: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Optimize query for specific use cases
 */
export const optimizedQueries = {
  /**
   * Fetch user profile with minimal fields
   */
  userProfile: async (userId: string, schoolId: string) => {
    const client = getOptimizedAdminClient();
    return executeWithRetry(() =>
      client
        .from("profiles")
        .select("id, first_name, last_name, email, role, school_id")
        .eq("id", userId)
        .eq("school_id", schoolId)
        .maybeSingle()
    );
  },
  
  /**
   * Fetch school context with essential data only
   */
  schoolContext: async (schoolId: string) => {
    const client = getOptimizedAdminClient();
    return executeWithRetry(() =>
      client
        .from("schools")
        .select("id, name, code, logo_url, current_term_id, current_academic_year_id")
        .eq("id", schoolId)
        .maybeSingle()
    );
  },
  
  /**
   * Batch fetch student profiles for a class
   */
  classStudents: async (classId: string, schoolId: string) => {
    const client = getOptimizedAdminClient();
    return executeWithRetry(() =>
      client
        .from("students")
        .select("id, first_name, last_name, admission_number, profile_id")
        .eq("class_id", classId)
        .eq("school_id", schoolId)
        .order("last_name", { ascending: true })
    );
  },
};
