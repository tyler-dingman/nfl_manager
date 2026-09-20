import type postgres from 'postgres';

const requiredColumns = {
  three_and_out_snapshots: {
    id: 'text',
    team_id: 'text',
    story_ids: 'jsonb',
    story_versions: 'jsonb',
    generated_at: 'timestamp with time zone',
    briefing_date: 'date',
    status: 'text',
    source_window_start: 'timestamp with time zone',
    source_window_end: 'timestamp with time zone',
    published_at: 'timestamp with time zone',
    items: 'jsonb',
    summary_version: 'text',
    audio_status: 'text',
    updated_at: 'timestamp with time zone',
  },
  three_and_out_push_deliveries: {
    briefing_id: 'text',
    user_id: 'uuid',
    channel: 'text',
    status: 'text',
    attempt_count: 'integer',
    last_error: 'text',
    attempted_at: 'timestamp with time zone',
    delivered_at: 'timestamp with time zone',
    created_at: 'timestamp with time zone',
    updated_at: 'timestamp with time zone',
  },
} as const;

type Column = { table_name: string; column_name: string; data_type: string };
export function missingDailySchemaColumns(columns: Column[]) {
  return Object.entries(requiredColumns).flatMap(([table, fields]) =>
    Object.entries(fields)
      .filter(
        ([column, type]) =>
          !columns.some(
            (row) =>
              row.table_name === table && row.column_name === column && row.data_type === type,
          ),
      )
      .map(([column]) => `${table}.${column}`),
  );
}

export class DailySchemaNotReadyError extends Error {
  readonly code = 'THREE_AND_OUT_SCHEMA_NOT_READY';
  constructor(readonly missing: string[]) {
    super(
      'Three & Out database schema is not ready. Apply db/migrations/033_three_and_out_daily.sql to this deployment’s DATABASE_URL, then rerun the readiness check.',
    );
    this.name = 'DailySchemaNotReadyError';
  }
}

export async function assertDailyThreeAndOutSchema(sql: postgres.Sql) {
  const columns = await sql<Column[]>`
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema=current_schema()
      AND table_name IN ('three_and_out_snapshots','three_and_out_push_deliveries')`;
  const missing = missingDailySchemaColumns(columns);
  if (missing.length) throw new DailySchemaNotReadyError(missing);
}
