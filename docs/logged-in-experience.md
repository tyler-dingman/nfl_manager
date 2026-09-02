# Logged-in Down & Distance experience

## Product behavior

Anonymous visitors can read team coverage, use Three and Out, and see the 4th Down poll. Authentication adds durable state rather than blocking basic content:

- Save Huddle stories and find them again under Account > Content.
- Sync Three and Out visits, material story changes, and audio progress across devices.
- Persist player follows, 4th Down votes, predictions, preferences, and device notification settings to the authenticated user.
- Preserve the current page through `/login?next=...` for contextual actions such as Save and voting.

## Data model

Migration `004_user_content_state.sql` adds `user_content_state`, `user_team_visit_state`, `user_saved_content`, `user_predictions`, and `user_poll_votes`. Each table is keyed by `user_id`; saved content and content state use a compound uniqueness key to make retries idempotent and isolate one user's state from another.

## API additions

- `GET/PUT /api/user/content-state` batches content state reads and records viewing, playback, and completion.
- `GET/POST/DELETE /api/user/saved-content` manages saved stories and future media types.
- `GET/PUT /api/user/team-visit` returns Catch Me Up data and records a team's last seen snapshot.
- `GET/POST /api/user/predictions` provides the immutable prediction submission foundation and lock-time validation.
- `POST /api/three-and-out/vote` requires the session cookie and stores one vote per user and question.
- `GET /api/user/home` now includes saved content with the primary team, follows, and preferences.

Native clients should use the same JSON contracts and authenticated session or mobile token strategy. Audio writes are throttled to meaningful intervals, and duplicate saves/votes are handled by database uniqueness constraints.

## Future hooks

The content-state table supports media versions, duration, progress, completion, and additional content types. The team visit snapshot contract is ready for richer editorial snapshots and material-change diffing. Anonymous intent can continue to be carried in a validated `next` destination or a short-lived client intent until authentication completes.
