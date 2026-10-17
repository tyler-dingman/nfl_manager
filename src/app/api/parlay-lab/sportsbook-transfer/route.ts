import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { assertSameOrigin } from '@/server/auth/http';
import {
  createTransferService,
  transferEnabled,
  TransferError,
} from '@/server/providers/unabated/transfer-service';
import { createProposalService } from '@/server/providers/unabated/transfer-proposals';
import { sportsbooks } from '../../../../../packages/parlay/sportsbook-transfer';
export const runtime = 'nodejs';
export const maxDuration = 30;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const ids = z
  .array(z.string().uuid())
  .min(1)
  .max(20)
  .refine((v) => new Set(v).size === v.length);
const book = z.enum(sportsbooks);
const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preview'), ids }).strict(),
  z
    .object({
      action: z.literal('start'),
      sportsbook: book,
      token: z.string().max(24000),
      approved: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal('poll'), sportsbook: book, id: z.string().uuid() }).strict(),
]);
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  const books = user ? sportsbooks.filter((b) => transferEnabled(user.id, process.env, b)) : [];
  const local = process.env.NODE_ENV === 'development';
  let error: string | undefined;
  if (local && !books.length) {
    if (!user) error = 'Sign in to prepare a sportsbook slip.';
    else if (
      !(process.env.FANDUEL_TEST_USER_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .includes(user.id)
    )
      error = 'Sportsbook transfers are not enabled for this test account.';
    else
      error =
        'Local sportsbook transfer configuration is disabled or incomplete. Check the transfer flags and provider configuration.';
  }
  return reply({ books, ...(error ? { error } : {}) });
}
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return reply({ error: 'Sign in to prepare a sportsbook slip.' }, 401);
    const raw = await request.text();
    if (raw.length > 28000) return reply({ error: 'Invalid transfer request.' }, 400);
    const body = input.safeParse(JSON.parse(raw));
    if (!body.success) return reply({ error: 'Invalid transfer request.' }, 400);
    const b = body.data,
      enabled = sportsbooks.filter((book) => transferEnabled(user.id, process.env, book));
    if ('sportsbook' in b && !enabled.includes(b.sportsbook))
      return reply({ error: 'Sportsbook transfers are not enabled for this account.' }, 403);
    if (b.action === 'preview') {
      const service = createProposalService();
      const results = await Promise.all(
        sportsbooks.map((book) => service.inspect(user.id, b.ids, book, enabled.includes(book))),
      );
      return reply({
        proposals: results.flatMap((r) => (r.proposal ? [r.proposal] : [])),
        compatibility: results.map((r) => r.compatibility),
      });
    }
    const service = createTransferService();
    if (b.action === 'poll') return reply(await service.poll(user.id, b.id, b.sportsbook));
    const legs = await createProposalService().approve(user.id, b.sportsbook, b.token, b.approved);
    return reply(
      await service.start(
        user.id,
        legs.map((l) => l.id),
        'UNSPECIFIED',
        b.sportsbook,
        legs,
      ),
    );
  } catch (e) {
    return reply(
      {
        error:
          e instanceof TransferError
            ? e.message
            : 'Unable to prepare this sportsbook slip. Your parlay has been preserved.',
      },
      e instanceof TransferError ? e.status : 400,
    );
  }
}
