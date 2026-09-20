import test from 'node:test';
import assert from 'node:assert/strict';
import type postgres from 'postgres';
import {
  assertDailyThreeAndOutSchema,
  DailySchemaNotReadyError,
  missingDailySchemaColumns,
} from './schema';

test('legacy snapshot schema reports actionable migration error before delivery queries', async () => {
  const legacy = [
    { table_name: 'three_and_out_snapshots', column_name: 'id', data_type: 'text' },
    { table_name: 'three_and_out_snapshots', column_name: 'team_id', data_type: 'text' },
    {
      table_name: 'three_and_out_snapshots',
      column_name: 'generated_at',
      data_type: 'timestamp with time zone',
    },
  ];
  const sql = (async () => legacy) as unknown as postgres.Sql;
  await assert.rejects(assertDailyThreeAndOutSchema(sql), (error) => {
    assert.ok(error instanceof DailySchemaNotReadyError);
    assert.equal(error.code, 'THREE_AND_OUT_SCHEMA_NOT_READY');
    assert.ok(error.missing.includes('three_and_out_snapshots.briefing_date'));
    assert.ok(error.missing.includes('three_and_out_push_deliveries.briefing_id'));
    assert.ok(!error.missing.includes('three_and_out_snapshots.id'));
    assert.match(error.message, /033_three_and_out_daily.sql/);
    return true;
  });
});

test('briefing_date must be a date, not a timestamp or a column on another table', () => {
  const column = {
    table_name: 'three_and_out_snapshots',
    column_name: 'briefing_date',
    data_type: 'date',
  };
  assert.ok(!missingDailySchemaColumns([column]).includes('three_and_out_snapshots.briefing_date'));
  assert.ok(
    missingDailySchemaColumns([{ ...column, data_type: 'timestamp with time zone' }]).includes(
      'three_and_out_snapshots.briefing_date',
    ),
  );
  assert.ok(
    missingDailySchemaColumns([{ ...column, table_name: 'briefings' }]).includes(
      'three_and_out_snapshots.briefing_date',
    ),
  );
});
