# Trivia local testing

## Solo

1. Start the app with `npm run dev -- --port 3000`.
2. Open `http://localhost:3000/trivia?team=KC`.
3. Sign out and confirm only **Play With Myself** is shown.
4. Start the game and confirm it contains 10 questions with a 20-second timer.

Anonymous games use a signed, HTTP-only, one-day guest cookie. Guest scores are excluded from public leaderboards.

## Buddy room with two browser sessions

1. Sign in as the host in a normal browser window.
2. Select **Play With Buddies**, create a room, and copy the invitation link.
3. Open the link in a private/incognito window and sign in as a second account.
4. The second session returns to the invitation after login and joins the waiting room.
5. Confirm both players show **READY** in the host window. Waiting-room state polls every two seconds.
6. Start Trivia from the host window. Both players receive the same 10 question IDs.

Repeat with separate browser profiles to test up to five total players. A sixth join is rejected. The host cannot start with fewer than two joined players.

## Scoring check

- Correct with 15 whole seconds remaining: 35 points.
- Correct with 5 whole seconds remaining: 25 points.
- Correct during the final partial second: 20 points.
- Wrong or timed out: 0 points.

The answer API accepts only the selected answer. Elapsed time and points are calculated from the server-side question presentation timestamp.
