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

export async function scheduleDueSources(
  now = new Date(),
  teamId?: string,
  group?: 'standard' | 'video',
) {
  const sources = await repo.dueSources(now, SOURCE_BATCH_SIZE, teamId, group);
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
  if (match.ambiguous && source.metadata.publishAll !== true) {
    await repo.setCandidateStatus(candidateId, 'REVIEW_REQUIRED', match.reason);
    return { action: 'review', match };
  }
  if (!match.storyId || match.ambiguous) {
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
    const evidence = [...(await repo.evidenceForStory(story.id)), { candidate, source }];
    const synth = await synthesizer.synthesize({ existingStory: story, evidence });
    // A confirming source must be allowed to promote a pending factual story. Preserve the
    // canonical wording for a non-material confirmation rather than copying the latest headline.
    synth.headline = story.headline;
    synth.summary = story.summary;
    synth.whatHappened = story.whatHappened;
    const decision = evaluatePublishingPolicy({
      story: synth,
      storyType: story.storyType,
      evidence,
      clusterConfidence: match.confidence,
      override: await repo.activePublishingOverride(story.id),
    });
    const promotes =
      story.publicationState !== 'AUTO_PUBLISHED' && decision.action === 'AUTO_PUBLISH';
    await repo.attachEvidence(
      story,
      candidate,
      source,
      promotes ? synth : null,
      promotes ? publicationStateFor(decision) : null,
      promotes ? 'SOURCE_CONFIRMATION' : 'TRIVIAL',
      promotes ? decision : undefined,
      match.reason,
    );
    return { action: promotes ? 'published' : 'corroborated', storyId: story.id };
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
    match.reason,
  );
  return { action: 'updated', storyId: story.id, change: change.changeType };
}

export async function processSource(
  source: RegisteredSource,
  fetcher: SourceFetcher = new RssSourceFetcher(),
  options: { publishedSince?: Date; teamId?: string } = {},
) {
  const started = Date.now();
  try {
    const result = await fetcher.fetch(source);
    let inserted = 0;
    const eligibleItems = options.publishedSince
      ? result.items.filter(
          (item) => new Date(item.publishedAt).getTime() >= options.publishedSince!.getTime(),
        )
      : result.items;
    for (const raw of eligibleItems) {
      const candidate = normalizeRawItem(raw, source);
      if (options.teamId && !candidate.candidateTeams.includes(options.teamId)) continue;
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
      Date.now() - started,
      result.items.length
        ? new Date(Math.max(...result.items.map((item) => new Date(item.publishedAt).getTime())))
        : null,
    );
    return {
      fetched: result.items.length,
      eligible: eligibleItems.length,
      inserted,
      notModified: result.notModified,
    };
  } catch (error) {
    await repo.markSourceFailure(
      source,
      error instanceof Error ? error.message : String(error),
      nextCheckAfterFailure(registeredSourceIntervalSeconds(source), source.failureCount + 1),
      Date.now() - started,
    );
    throw error;
  }
}

export async function workOne(workerId = `${hostname()}:${process.pid}`, teamId?: string) {
  const job = await repo.claimJob(workerId, teamId);
  if (!job) return null;
  try {
    let result;
    if (job.job_type === 'SOURCE_FETCH') {
      const source = await repo.sourceById(job.payload.sourceId);
      if (!source) throw new Error('Source not found.');
      result = await processSource(source, new RssSourceFetcher(), { teamId });
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

export async function drainJobs(max = 100, teamId?: string) {
  const results = [];
  for (let i = 0; i < max; i++) {
    const result = await workOne(undefined, teamId);
    if (!result) break;
    results.push(result);
  }
  return results;
}

export async function replayRecentStories(teamId: string, hours: number) {
  const since = new Date(Date.now() - hours * 3_600_000);
  const storyIds = await repo.storyIdsWithEvidenceSince(teamId, since);
  const results: Array<{ storyId: string; action: string; reason: string }> = [];
  for (const storyId of storyIds) {
    const story = await repo.storyById(storyId);
    if (!story || ['AUTO_PUBLISHED', 'PUBLISHED'].includes(story.publicationState)) continue;
    const evidence = await repo.evidenceForStory(storyId);
    const tierThreeOnly = evidence.every(({ source }) => source.pollingTier === 'C');
    const explicitlyTeamRelevant = evidence.some(({ candidate }) =>
      /\b(?:chiefs|kansas city|kc)\b/i.test(`${candidate.title} ${candidate.excerpt}`),
    );
    if (tierThreeOnly && !explicitlyTeamRelevant) {
      results.push({
        storyId,
        action: 'held',
        reason: 'Tier 3 item is not explicitly Chiefs-relevant.',
      });
      continue;
    }
    const synth = await new GroundedDeterministicStorySynthesizer().synthesize({
      existingStory: story,
      evidence,
    });
    const decision = evaluatePublishingPolicy({
      story: synth,
      storyType: story.storyType,
      evidence,
      override: await repo.activePublishingOverride(story.id),
    });
    if (decision.action !== 'AUTO_PUBLISH') {
      results.push({ storyId, action: 'held', reason: decision.reason });
      continue;
    }
    synth.status = decision.breaking ? 'BREAKING' : synth.status;
    await repo.promoteExistingStory(story, synth, decision);
    results.push({ storyId, action: 'published', reason: decision.reason });
  }
  return results;
}
