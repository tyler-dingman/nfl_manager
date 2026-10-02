import type { Snapshot } from './index';
/** Local-only concept data. Never fetches or persists anything. */
export function createDemoHuddle() {
  const rooms = new Map<string, Snapshot>();
  return (team: string, body?: any) => {
    let data = rooms.get(team);
    if (!data) {
      const now = new Date().toISOString();
      data = {
        messages: [
          {
            id: 'sample-message',
            userId: 'sample-fan',
            name: 'Sample Fan',
            avatar: null,
            body: 'Welcome to the preview Huddle. What stood out on that drive?',
            at: now,
            playId: 'sample-play',
            likes: 3,
            removed: false,
          },
        ],
        polls: [
          {
            id: 'sample-poll',
            question: 'What changed the game?',
            options: ['Offense', 'Defense'],
            counts: [4, 3],
            closed: false,
          },
        ],
        game: {
          id: 'sample-game',
          home: team === 'DAL' ? 'PHI' : 'DAL',
          away: team,
          homeScore: 10,
          awayScore: 17,
          status: 'live',
          clock: '6:24',
          quarter: 3,
          kickoff: now,
          possession: team,
          down: '3rd & 4',
          location: `${team} 42`,
          ball: 42,
          direction: 1,
          driveId: 'sample-drive',
          driveSummary: 'Sample drive · 6 plays, 48 yards',
          updatedAt: now,
          plays: [
            {
              id: 'sample-play',
              sequence: 1,
              quarter: 3,
              clock: '6:24',
              down: '3rd & 4',
              location: `${team} 42`,
              text: 'Sample play: pass complete for 12 yards. First down.',
              yards: 12,
              scoring: false,
              key: true,
              driveId: 'sample-drive',
              at: now,
            },
          ],
        },
        participants: null,
        cursor: now,
        before: null,
        hiddenUsers: [],
        voted: {},
        liked: [],
        canModerate: false,
      };
      rooms.set(team, data);
    }
    if (body) {
      if (body.action === 'message')
        data.messages.push({
          id: body.clientId,
          userId: 'local-demo',
          name: 'Test Fan',
          avatar: null,
          body: body.body,
          at: new Date().toISOString(),
          playId: 'sample-play',
          likes: 0,
          removed: false,
        });
      if (body.action === 'vote' && data.voted[body.id] === undefined) {
        data.voted[body.id] = body.choice;
        const poll = data.polls.find((p) => p.id === body.id);
        if (poll) poll.counts[body.choice]++;
      }
      if (body.action === 'like') {
        const m = data.messages.find((m) => m.id === body.id);
        if (m) {
          m.likes += body.enabled ? 1 : -1;
          data.liked = body.enabled
            ? [...data.liked, body.id]
            : data.liked.filter((id) => id !== body.id);
        }
      }
      if (body.action === 'mute' || body.action === 'block') data.hiddenUsers.push(body.userId);
      if (body.action === 'unhide')
        data.hiddenUsers = data.hiddenUsers.filter((id) => id !== body.userId);
      return { ok: true };
    }
    return data;
  };
}
