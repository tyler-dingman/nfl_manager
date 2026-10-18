import { Storage } from './core';
export interface BriefingRow {
  id: string;
  teamId: string;
  briefingDate: string;
  generatedAt: string;
  publishedAt: string | null;
  sourceWindowStart: string | null;
  sourceWindowEnd: string | null;
  summaryVersion: string;
  items: any[];
}
export class DailyBriefings {
  constructor(readonly s: Storage) {}
  async publish(row: BriefingRow, mail?: { subject: string; text: string }) {
    if (row.items.length !== 3) throw Error('A daily briefing requires three verified stories');
    const hash = await this.s.put({ schema: 1, kind: 'DAILY_BRIEFING', row });
    const statements = [
      this.s.statement(
        'INSERT INTO app_daily_briefings(id,team_id,briefing_date,generated_at,published_at,object_hash,summary_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET generated_at=excluded.generated_at,published_at=excluded.published_at,object_hash=excluded.object_hash,summary_json=excluded.summary_json',
        [
          row.id,
          row.teamId,
          row.briefingDate,
          Date.parse(row.generatedAt),
          Date.parse(row.publishedAt ?? row.generatedAt),
          hash,
          JSON.stringify(row.items.map((i) => ({ id: i.id, title: i.title }))),
        ],
      ),
    ];
    if (mail) {
      const publication = await this.s.put({
        approved: true,
        id: row.id,
        team: row.teamId,
        date: row.briefingDate,
        subject: mail.subject,
        text: mail.text,
      });
      statements.push(
        this.s.statement(
          "INSERT INTO app_briefing_mail_jobs(id,object_hash,status) VALUES(?,?,'READY') ON CONFLICT DO NOTHING",
          [row.id, publication],
        ),
      );
    }
    await this.s.batch(statements);
    return hash;
  }
  async latest(team: string, date?: string): Promise<BriefingRow[]> {
    const rows = await this.s.rows<any>(
      'SELECT id,object_hash FROM app_daily_briefings WHERE team_id=? AND (? IS NULL OR briefing_date=?) ORDER BY briefing_date DESC,published_at DESC LIMIT 1',
      [team, date ?? null, date ?? null],
    );
    return Promise.all(
      rows.map(async (r) => {
        const envelope = await this.s.get<any>(r.object_hash);
        if (
          envelope.schema !== 1 ||
          envelope.kind !== 'DAILY_BRIEFING' ||
          envelope.row.id !== r.id ||
          envelope.row.teamId !== team
        )
          throw Error('Briefing identity mismatch');
        return envelope.row;
      }),
    );
  }
  async history(team: string, exclude: string) {
    const rows = await this.s.rows<any>(
      'SELECT id,team_id AS teamId,briefing_date AS briefingDate,generated_at AS generatedAt,summary_json FROM app_daily_briefings WHERE team_id=? AND id<>? ORDER BY briefing_date DESC LIMIT 14',
      [team, exclude],
    );
    return rows.map((r) => ({
      ...r,
      generatedAt: new Date(r.generatedAt).toISOString(),
      items: JSON.parse(r.summary_json),
    }));
  }
  async previousPublished(team: string) {
    const [row] = await this.s.rows<{ published_at: number }>(
      'SELECT published_at FROM app_daily_briefings WHERE team_id=? ORDER BY published_at DESC LIMIT 1',
      [team],
    );
    return row ? [{ publishedAt: new Date(row.published_at) }] : [];
  }
}
