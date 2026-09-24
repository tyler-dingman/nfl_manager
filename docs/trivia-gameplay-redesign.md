# Trivia gameplay redesign

The live game uses the standard site typeface and a responsive question-first layout. The lobby and global navigation retain their existing designs. The old field, scoreboard, slogans, and gameplay CSS have been removed.

`trivia-game.tsx` retains the existing question loading, server answer submission, shared question deadline, feedback phases, and rematch routes. `trivia-game.module.css` controls the desktop two-column layout and mobile question → stats → standings → activity → game-info order.

The existing game GET route accepts `?live=1` for an authenticated, participant-scoped read-only snapshot. It returns server-ordered standings and the five most recent persisted answer events. Polling runs every 1.2 seconds and immediately after an answer response; unlike loading the next question, it never starts a question timer. Failed polls preserve the last standings and show reconnecting status. Scores are not predicted on the client.

Game configuration and scoring are unchanged (10 questions, 24 seconds, 10 points per correct answer). The local browser audit temporarily shortens its fixture game timer after capturing screenshots, and uses two temporary players to verify correct/incorrect/timeout feedback and all ten question advances. It deletes its game and users afterward.

Validation commands:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test:trivia`
- `node --import tsx scripts/audit-trivia-redesign.ts` (local app on port 3100 and local database only)

Browser screenshots are written to `/tmp/trivia-redesign-audit` at 1440, 1280, 1024, 768, 430, 390, and 375 pixels.
