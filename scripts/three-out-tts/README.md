# Three & Out local voice proof-of-concept

This is an isolated, single-process Chatterbox test. It does not run through Next.js,
an API route, a scheduler, or the production content pipeline.

The default command reuses the previously working Chatterbox 0.1.7/Python 3.11
environment and original model:

```sh
npm run three-out:voice:test
```

Set `VOICE_REFERENCE_PATH` to override the default private reference WAV. Optional
settings are `THREE_OUT_TTS_DEVICE` (`auto`, `mps`, or `cpu`),
`THREE_OUT_TTS_MODEL` (`original` or `turbo`), `THREE_OUT_TTS_EXAGGERATION`,
`THREE_OUT_TTS_CFG_WEIGHT`, `THREE_OUT_TTS_SEED`, and
`THREE_OUT_TTS_MIN_FREE_GB`.

The command stops before model loading when less than 4 GB of system memory is
available. It never automatically retries. Output is written without overwriting
prior tests under `tmp/three-out/`.

After the first test succeeds, run the pronunciation test once:

```sh
npm run three-out:voice:names
```

After both basic tests succeed, the isolated Phase 2 proof-of-concept generates
three short downs sequentially, conditions the reference voice once, and joins
the chunks with 350 milliseconds of silence:

```sh
npm run three-out:voice:phase2
```

Phase 2 remains local-only. It does not publish audio or connect generation to
the application, content engine, or a background schedule.
