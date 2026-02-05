'use client';

import * as React from 'react';

import { PlayerTable } from '@/components/player-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPickValue } from '@/lib/draft-utils';
import { cn } from '@/lib/utils';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';

const SPEED_LABELS = ['Slow', 'Fast', 'Turbo'] as const;

export type DraftSpeedLevel = 0 | 1 | 2;

type ActiveDraftRoomProps = {
  session: DraftSessionDTO;
  saveId: string;
  draftSessionId: string;
  teams: Array<{ abbr: string; name: string; logoUrl: string; colors: string[] }>;
  speedLevel: DraftSpeedLevel;
  onSpeedChange: (level: DraftSpeedLevel) => void;
  onTogglePause: () => void;
  onDraftPlayer?: (player: PlayerRowDTO) => void;
  onSessionUpdate: (session: DraftSessionDTO) => void;
};

const formatName = (player: PlayerRowDTO) => `${player.firstName} ${player.lastName}`;

export function ActiveDraftRoom({
  session,
  saveId,
  draftSessionId,
  teams,
  speedLevel,
  onSpeedChange,
  onTogglePause,
  onDraftPlayer,
  onSessionUpdate,
}: ActiveDraftRoomProps) {
  const currentPick = session.picks[session.currentPickIndex];
  const onClock = currentPick?.ownerTeamAbbr === session.userTeamAbbr;
  const speedLabel = SPEED_LABELS[speedLevel] ?? SPEED_LABELS[1];
  const [activeTab, setActiveTab] = React.useState<'available' | 'drafted' | 'trade'>(
    onClock ? 'available' : 'drafted',
  );
  const [partnerTeamAbbr, setPartnerTeamAbbr] = React.useState('');
  const [sendPickId, setSendPickId] = React.useState('');
  const [receivePickId, setReceivePickId] = React.useState('');
  const [tradeQuote, setTradeQuote] = React.useState<{
    sendValue: number;
    receiveValue: number;
    acceptanceProbability: number;
    verdict: 'likely' | 'fair' | 'unlikely';
  } | null>(null);
  const [isQuoting, setIsQuoting] = React.useState(false);
  const [tradeError, setTradeError] = React.useState('');
  const [tradeResult, setTradeResult] = React.useState<
    | {
        accepted: boolean;
        reason?: string;
      }
    | null
  >(null);
  const advanceInFlight = React.useRef(false);
  const skipInFlight = React.useRef(false);

  const bestAvailable = React.useMemo(() => {
    return session.prospects
      .filter((player) => !player.isDrafted)
      .slice()
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }, [session.prospects]);

  React.useEffect(() => {
    if (activeTab === 'trade') {
      return;
    }
    setActiveTab(onClock ? 'available' : 'drafted');
  }, [activeTab, onClock]);

  const draftedPicks = React.useMemo(() => {
    const drafted = session.picks
      .filter((pick) => pick.selectedPlayerId)
      .slice()
      .sort((a, b) => a.overall - b.overall);
    return drafted;
  }, [session.picks]);

  const teamLookup = React.useMemo(() => {
    const map = new Map(teams.map((team) => [team.abbr, team]));
    return map;
  }, [teams]);

  const partnerTeams = React.useMemo(() => {
    const teamSet = new Set(session.picks.map((pick) => pick.ownerTeamAbbr));
    teamSet.delete(session.userTeamAbbr);
    return Array.from(teamSet).sort();
  }, [session.picks, session.userTeamAbbr]);

  const eligibleUserPicks = React.useMemo(() => {
    return session.picks.filter(
      (pick) =>
        pick.round === 1 &&
        pick.ownerTeamAbbr === session.userTeamAbbr &&
        !pick.selectedPlayerId &&
        pick.overall > session.currentPickIndex + 1,
    );
  }, [session.currentPickIndex, session.picks, session.userTeamAbbr]);

  const eligiblePartnerPicks = React.useMemo(() => {
    if (!partnerTeamAbbr) {
      return [];
    }
    return session.picks.filter(
      (pick) =>
        pick.round === 1 &&
        pick.ownerTeamAbbr === partnerTeamAbbr &&
        !pick.selectedPlayerId &&
        pick.overall > session.currentPickIndex + 1,
    );
  }, [partnerTeamAbbr, session.currentPickIndex, session.picks]);

  React.useEffect(() => {
    if (!partnerTeamAbbr && partnerTeams.length > 0) {
      setPartnerTeamAbbr(partnerTeams[0]);
    }
  }, [partnerTeamAbbr, partnerTeams]);

  React.useEffect(() => {
    setSendPickId('');
    setReceivePickId('');
    setTradeQuote(null);
    setTradeError('');
  }, [partnerTeamAbbr]);

  React.useEffect(() => {
    const fetchQuote = async () => {
      if (!sendPickId || !receivePickId || !partnerTeamAbbr) {
        setTradeQuote(null);
        return;
      }
      setIsQuoting(true);
      setTradeError('');
      try {
        const response = await fetch('/api/draft/trades/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftSessionId,
            sendPickId,
            receivePickId,
            partnerTeamAbbr,
          }),
        });
        const payload = (await response.json()) as
          | {
              ok: true;
              sendValue: number;
              receiveValue: number;
              acceptanceProbability: number;
              verdict: 'likely' | 'fair' | 'unlikely';
            }
          | { ok: false; error: string };
        if (!response.ok || !payload.ok) {
          setTradeQuote(null);
          setTradeError(payload.ok ? 'Unable to fetch trade quote.' : payload.error);
        } else {
          setTradeQuote({
            sendValue: payload.sendValue,
            receiveValue: payload.receiveValue,
            acceptanceProbability: payload.acceptanceProbability,
            verdict: payload.verdict,
          });
        }
      } catch {
        setTradeError('Unable to fetch trade quote.');
      } finally {
        setIsQuoting(false);
      }
    };

    void fetchQuote();
  }, [draftSessionId, partnerTeamAbbr, receivePickId, sendPickId]);

  const advanceCpuPick = React.useCallback(async () => {
    if (advanceInFlight.current || skipInFlight.current) {
      return;
    }
    advanceInFlight.current = true;
    try {
      const response = await fetch('/api/draft/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftSessionId, saveId }),
      });
      const text = await response.text();
      if (!text) {
        return;
      }
      const payload = JSON.parse(text) as
        | { ok: true; session: DraftSessionDTO }
        | { ok: false; error: string };
      if (response.ok && payload.ok) {
        onSessionUpdate(payload.session);
      }
    } finally {
      advanceInFlight.current = false;
    }
  }, [draftSessionId, onSessionUpdate, saveId]);

  const handleSkipToUserPick = React.useCallback(async () => {
    if (onClock || skipInFlight.current) {
      return;
    }
    skipInFlight.current = true;
    try {
      let safety = 0;
      let snapshot = session;
      while (safety < 64) {
        const current = snapshot.picks[snapshot.currentPickIndex];
        if (!current || current.ownerTeamAbbr === snapshot.userTeamAbbr) {
          onSessionUpdate(snapshot);
          break;
        }
        const response = await fetch('/api/draft/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftSessionId, saveId }),
        });
        const text = await response.text();
        if (!text) {
          break;
        }
        const payload = JSON.parse(text) as
          | { ok: true; session: DraftSessionDTO }
          | { ok: false; error: string };
        if (!response.ok || !payload.ok) {
          break;
        }
        snapshot = payload.session;
        onSessionUpdate(snapshot);
        safety += 1;
      }
    } finally {
      skipInFlight.current = false;
    }
  }, [draftSessionId, onClock, onSessionUpdate, saveId, session]);

  React.useEffect(() => {
    if (session.status !== 'in_progress') {
      return;
    }
    if (session.isPaused || onClock) {
      return;
    }
    const delay = speedLevel === 0 ? 1500 : speedLevel === 2 ? 350 : 1000;
    const timer = window.setTimeout(() => {
      void advanceCpuPick();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [advanceCpuPick, onClock, session.isPaused, session.status, speedLevel]);

  const handleProposeTrade = async () => {
    if (!sendPickId || !receivePickId || !partnerTeamAbbr) {
      return;
    }
    setTradeError('');
    try {
      const response = await fetch('/api/draft/trades/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftSessionId,
          saveId,
          sendPickId,
          receivePickId,
          partnerTeamAbbr,
        }),
      });
      const payload = (await response.json()) as
        | { ok: true; accepted: true; session: DraftSessionDTO }
        | { ok: true; accepted: false; reason: string }
        | { ok: false; error: string };
      if (!response.ok || !payload.ok) {
        setTradeError(payload.ok ? 'Unable to propose trade.' : payload.error);
        return;
      }
      if (payload.accepted) {
        onSessionUpdate(payload.session);
        setTradeResult({ accepted: true });
      } else {
        setTradeResult({ accepted: false, reason: payload.reason });
      }
    } catch {
      setTradeError('Unable to propose trade.');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Draft Board</h2>
          <span className="text-xs text-muted-foreground">
            Pick {session.currentPickIndex + 1} of {session.picks.length}
          </span>
        </div>
        <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-2">
          {session.picks.map((pick, index) => {
            const isCurrent = index === session.currentPickIndex;
            const isNext = index === session.currentPickIndex + 1;
            const selectedPlayer = pick.selectedPlayerId
              ? session.prospects.find((player) => player.id === pick.selectedPlayerId)
              : null;
            return (
              <div
                key={pick.id}
                className={cn(
                  'rounded-xl border border-border px-3 py-2 text-sm',
                  isCurrent && 'border-primary/40 bg-primary/5',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    #{pick.overall} · {pick.ownerTeamAbbr}
                  </span>
                  {pick.ownerTeamAbbr === session.userTeamAbbr && (
                    <Badge variant="secondary">User</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedPlayer
                    ? `${pick.ownerTeamAbbr} drafted ${formatName(selectedPlayer)} (${selectedPlayer.position})`
                    : isCurrent
                      ? 'On the clock'
                      : isNext
                        ? 'On deck'
                        : 'Waiting'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                On the Clock
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                {currentPick
                  ? `Pick ${currentPick.overall} — ${currentPick.ownerTeamAbbr}`
                  : 'Awaiting pick'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Round {currentPick?.round ?? 1} · {onClock ? 'Your pick' : 'CPU pick'}
              </p>
            </div>
            <Badge variant={onClock ? 'success' : session.isPaused ? 'outline' : 'secondary'}>
              {onClock ? 'On the clock' : session.isPaused ? 'Paused' : 'Running'}
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button type="button" variant="outline" onClick={onTogglePause}>
              {session.isPaused ? 'Resume Draft' : 'Pause Draft'}
            </Button>
            <Button type="button" variant="outline" onClick={handleSkipToUserPick}>
              Skip to User Pick
            </Button>
            <div className="min-w-[220px]">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Speed</span>
                <span>{speedLabel}</span>
              </div>
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={2}
                step={1}
                value={speedLevel}
                onChange={(event) => onSpeedChange(Number(event.target.value) as DraftSpeedLevel)}
              />
              <div className="mt-1 flex justify-between text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
                {SPEED_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={activeTab === 'available' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-full px-4"
                onClick={() => setActiveTab('available')}
              >
                Available
              </Button>
              <Button
                type="button"
                variant={activeTab === 'drafted' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-full px-4"
                onClick={() => setActiveTab('drafted')}
              >
                Drafted
              </Button>
              <Button
                type="button"
                variant={activeTab === 'trade' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-full px-4"
                onClick={() => setActiveTab('trade')}
              >
                Trade
              </Button>
            </div>
            {currentPick ? (
              <span className="text-xs text-muted-foreground">
                Pick {currentPick.overall} · {currentPick.ownerTeamAbbr}
              </span>
            ) : null}
          </div>

          {activeTab === 'available' ? (
            <div className="mt-4">
              {onClock ? (
                <PlayerTable
                  data={bestAvailable}
                  variant="draft"
                  onDraftPlayer={onClock ? onDraftPlayer : undefined}
                  onTheClockForUserTeam={onClock}
                />
              ) : (
                <div className="rounded-xl border border-border bg-slate-50 px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-foreground">Waiting for your pick...</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Available prospects unlock when your team is on the clock.
                  </p>
                </div>
              )}
            </div>
          ) : activeTab === 'drafted' ? (
            <div className="mt-4 space-y-3">
              {draftedPicks.length === 0 ? (
                <div className="rounded-xl border border-border bg-slate-50 px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-foreground">No picks yet</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Drafted players will appear here in order.
                  </p>
                </div>
              ) : (
                draftedPicks.map((pick) => {
                  const player = session.prospects.find(
                    (prospect) => prospect.id === pick.selectedPlayerId,
                  );
                  const team = teamLookup.get(pick.ownerTeamAbbr);
                  return (
                    <div
                      key={pick.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2 text-sm"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        {team?.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={team.logoUrl} alt={team.name} className="h-6 w-6" />
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {pick.ownerTeamAbbr}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          Pick {pick.overall} · {pick.ownerTeamAbbr}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {player
                            ? `${formatName(player)} · ${player.position}`
                            : 'Selection pending'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-border bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Trade Partner
                </p>
                <select
                  className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                  value={partnerTeamAbbr}
                  onChange={(event) => setPartnerTeamAbbr(event.target.value)}
                >
                  {partnerTeams.map((abbr) => (
                    <option key={abbr} value={abbr}>
                      {abbr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Your Pick
                  </p>
                  <select
                    className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                    value={sendPickId}
                    onChange={(event) => setSendPickId(event.target.value)}
                  >
                    <option value="">Select pick</option>
                    {eligibleUserPicks.map((pick) => (
                      <option key={pick.id} value={pick.id}>
                        Pick {pick.overall} ({pick.ownerTeamAbbr}) · Value{' '}
                        {getPickValue(pick.overall)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-border bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Their Pick
                  </p>
                  <select
                    className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                    value={receivePickId}
                    onChange={(event) => setReceivePickId(event.target.value)}
                  >
                    <option value="">Select pick</option>
                    {eligiblePartnerPicks.map((pick) => (
                      <option key={pick.id} value={pick.id}>
                        Pick {pick.overall} ({pick.ownerTeamAbbr}) · Value{' '}
                        {getPickValue(pick.overall)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Send value</span>
                  <span>{tradeQuote?.sendValue ?? '--'}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Receive value</span>
                  <span>{tradeQuote?.receiveValue ?? '--'}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Difference</span>
                  <span>
                    {tradeQuote
                      ? tradeQuote.receiveValue - tradeQuote.sendValue
                      : '--'}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Acceptance %</span>
                  <span>
                    {tradeQuote
                      ? `${Math.round(tradeQuote.acceptanceProbability * 100)}% (${tradeQuote.verdict})`
                      : '--'}
                  </span>
                </div>
                {isQuoting ? (
                  <p className="mt-2 text-xs text-muted-foreground">Calculating quote...</p>
                ) : null}
                {tradeError ? (
                  <p className="mt-2 text-xs text-destructive">{tradeError}</p>
                ) : null}
              </div>

              <Button
                type="button"
                onClick={handleProposeTrade}
                disabled={!sendPickId || !receivePickId || !partnerTeamAbbr || isQuoting}
              >
                Offer Trade
              </Button>
            </div>
          )}
        </div>
      </section>
      {tradeResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">
              {tradeResult.accepted ? 'Trade Accepted' : 'Trade Rejected'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tradeResult.accepted
                ? 'Ownership has been updated on the board.'
                : tradeResult.reason ?? 'The other team rejected your offer.'}
            </p>
            <Button
              type="button"
              className="mt-4 w-full"
              onClick={() => setTradeResult(null)}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
