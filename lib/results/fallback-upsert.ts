export type FallbackResultRow = {
  student_id: string;
  assignment_id: string;
  exam_id: string | null;
  score: number | null;
  grade: string | null;
  school_id: string;
};

type DbError = { code?: string; message?: string } | null;

export type ResultsClientLike = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          in(column: string, values: string[]): PromiseLike<{
            data: Array<{ id: string; student_id: string }> | null;
            error: DbError;
          }>;
        };
      };
    };
    insert(rows: unknown[]): PromiseLike<{ error: DbError }>;
    upsert(
      rows: unknown[],
      options?: { onConflict?: string },
    ): PromiseLike<{ error: DbError }>;
  };
};

/** Batched replacement for the old per-row fallback upsert.
 *  One lookup, one batch insert, one batch upsert-by-id instead of
 *  2 round-trips per result row. Preserves the original semantics:
 *  new rows are inserted as drafts; existing rows keep grading_status. */
export async function batchFallbackUpsertResults(
  client: ResultsClientLike,
  schoolId: string,
  rows: FallbackResultRow[],
): Promise<{ created: number; updated: number }> {
  if (rows.length === 0) return { created: 0, updated: 0 };

  const assignmentId = rows[0].assignment_id;
  const studentIds = rows.map((row) => row.student_id);

  const { data: existingRows, error: lookupError } = await client
    .from("results")
    .select("id, student_id")
    .eq("school_id", schoolId)
    .eq("assignment_id", assignmentId)
    .in("student_id", studentIds);

  if (lookupError) throw new Error(lookupError.message || "Failed to look up existing results");

  const existingByStudent = new Map(
    (existingRows || []).map((row) => [row.student_id, row.id]),
  );

  const toUpdate = rows
    .filter((row) => existingByStudent.has(row.student_id))
    .map((row) => ({
      id: existingByStudent.get(row.student_id),
      score: row.score,
      grade: row.grade,
      exam_id: row.exam_id,
    }));

  const toInsert = rows
    .filter((row) => !existingByStudent.has(row.student_id))
    .map((row) => ({
      school_id: schoolId,
      student_id: row.student_id,
      assignment_id: row.assignment_id,
      exam_id: null,
      score: row.score,
      grade: row.grade,
      grading_status: "draft",
    }));

  let created = 0;
  let updated = 0;

  if (toUpdate.length > 0) {
    const { error: upsertError } = await client
      .from("results")
      .upsert(toUpdate, { onConflict: "id" });
    if (upsertError) throw new Error(upsertError.message || "Failed to update results");
    updated += toUpdate.length;
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await client.from("results").insert(toInsert);
    if (insertError) {
      // Unique violation - rows were inserted concurrently, treat as updates.
      if (insertError.code === "23505" || insertError.message?.includes("unique")) {
        updated += toInsert.length;
      } else {
        throw new Error(insertError.message || "Failed to insert results");
      }
    } else {
      created += toInsert.length;
    }
  }

  return { created, updated };
}
