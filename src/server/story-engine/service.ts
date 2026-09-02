import { hostname } from 'node:os';
import { findCandidateStory } from '@/features/story-engine/clustering';
import {
  nextCheckAfterFailure,
  nextCheckAfterSuccess,
  SOURCE_BATCH_SIZE,
  registeredSourceIntervalSeconds,
} from '@/features/story-engine/config';
import { evaluateMaterialChange } from '@/features/story-engine/material-change';
import { normalizeRawItem } from '@/features/story-engine/normalization';
import {
  GroundedDeterministicStorySynthesizer,
  type StorySynthesizer,
} from '@/features/story-engine/synthesis';
import {
  evaluatePublishingPolicy,
  publicationStateFor,
} from '@/features/story-engine/publishing-policy';
import type { RegisteredSource } from '@/features/story-engine/types';
import { RssSourceFetcher, type SourceFetcher } from './fetcher';
import * as repo from './repository';

export async function scheduleDueSources(now = new Date()) {
  const sources = await repo.dueSources(now, SOURCE_BATCH_SIZE);
  let queued = 0;
  for (const source of sources) {
    const intervalSeconds = registeredSourceIntervalSeconds(source);
    const bucket = Math.floor(now.getTime() / (intervalSeconds * 1000));
    if (
      await repo.enqueueJob('SOURCE_FETCH', `fetch:${source.id}:${bucket}`, { sourceId: source.id })
    )
      queued++;
  }
  return { due: sources.length, queued };
}

export async function processCandidate(
  candidateId: string,
  synthesizer: StorySynthesizer = new GroundedDeterministicStorySynthesizer(),
) {
  const candidate = await repo.candidateById(candidateId);
  if (!candidate || candidate.status !== 'NEW') return { action: 'ignored' };
  const source = await repo.sourceById(candidate.sourceId);
  if (!source) throw new Error(`Unknown source ${candidate.sourceId}`);
  if (!candidate.title || (!candidate.candidateTeams.length && !source.leagueWide)) {
    await repo.setCandidateStatus(candidateId, 'REJECTED', 'No usable title or team match.');
    return { action: 'rejected' };
  }
  const stories = await repo.recentStories(
    candidate.candidateTeams,
    new Date(Date.now() - 72 * 3_600_000),
  );
  const match = findCandidateStory(candidate, stories);
  if (match.ambiguous) {
    await repo.setCandidateStatus(candidateId, 'REVIEW_REQUIRED', match.reason);
    return { action: 'review', match };
  }
  if (!match.storyId) {
    const synth = await synthesizer.synthesize({
      existingStory: null,
      evidence: [{ candidate, source }],
    });
    const decision = evaluatePublishingPolicy({
      story: synth,
      storyType: candidate.storyType,
      evidence: [{ candidate, source }],
    });
    synth.status =
      synth.status === 'RESOLVED' ? 'RESOLVED' : decision.breaking ? 'BREAKING' : 'DEVELOPING';
    const id = await repo.createStory(
      candidate,
      source,
      synth,
      publicationStateFor(decision),
      'NEW_FACT',
      decision,
    );
    return { action: 'created', storyId: id };
  }
  const story = await repo.storyById(match.storyId);
  if (!story) throw new Error('Matched story disappeared.');
  const official = source.sourceType === 'OFFICIAL_TEAM' || source.sourceType === 'NFL_OFFICIAL';
  const change = evaluateMaterialChange(story, candidate, official);
  if (!change.material) {
    await repo.attachEvidence(story, candidate, source, null, null, 'TRIVIAL');
    return { action: 'corroborated', storyId: story.id };
  }
  const evidence = [...(await repo.evidenceForStory(story.id)), { candidate, source }];
  const synth = await synthesizer.synthesize({ existingStory: story, evidence });
  const decision = evaluatePublishingPolicy({
    story: synth,
    storyType: candidate.storyType,
    evidence,
    override: await repo.activePublishingOverride(story.id),
  });
  synth.status =
    synth.status === 'RESOLVED'
      ? 'RESOLVED'
      : decision.breaking
        ? 'BREAKING'
        : synth.status === 'BREAKING'
          ? 'DEVELOPING'
          : synth.status;
  await repo.attachEvidence(
    story,
    candidate,
    source,
    synth,
    publicationStateFor(decision),
    change.changeType,
    decision,
  );
  return { action: 'updated', storyId: story.id, change: change.changeType };
}

export async function processSource(
  source: RegisteredSource,
  fetcher: SourceFetcher = new RssSourceFetcher(),
) {
  try {
    const result = await fetcher.fetch(source);
    let inserted = 0;
    for (const raw of result.items) {
      const candidate = normalizeRawItem(raw, source);
      const id = await repo.saveCandidate(candidate);
      if (id) {
        inserted++;
        await repo.enqueueJob('CANDIDATE_PROCESS', `candidate:${id}`, { candidateId: id });
      }
    }
    await repo.markSourceSuccess(
      source,
      result.etag,
      result.lastModified,
      nextCheckAfterSuccess(registeredSourceIntervalSeconds(source)),
    );
    return { fetched: result.items.length, inserted, notModified: result.notModified };
  } catch (error) {
    await repo.markSourceFailure(
      source,
      error instanceof Error ? error.message : String(error),
      nextCheckAfterFailure(registeredSourceIntervalSeconds(source), source.failureCount + 1),
    );
    throw error;
  }
}

export async function workOne(workerId = `${hostname()}:${process.pid}`) {
  const job = await repo.claimJob(workerId);
  if (!job) return null;
  try {
    let result;
    if (job.job_type === 'SOURCE_FETCH') {
      const source = await repo.sourceById(job.payload.sourceId);
      if (!source) throw new Error('Source not found.');
      result = await processSource(source);
    } else result = await processCandidate(job.payload.candidateId);
    await repo.finishJob(job.id);
    return { jobId: job.id, type: job.job_type, result };
  } catch (error) {
    await repo.failJob(
      job.id,
      error instanceof Error ? error.message : String(error),
      Math.min(3600, 30 * 2 ** job.attempts),
    );
    throw error;
  }
}

export async function drainJobs(max = 100) {
  const results = [];
  for (let i = 0; i < max; i++) {
    const result = await workOne();
    if (!result) break;
    results.push(result);
  }
  return results;
}
