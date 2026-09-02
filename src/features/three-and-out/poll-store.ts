type PollVoteState = Map<string, Map<string, string>>;

const globalPollStore = globalThis as typeof globalThis & {
  __downDistancePollVotes?: PollVoteState;
};

const votes = (globalPollStore.__downDistancePollVotes ??= new Map());

export function getPollVotes(questionId: string) {
  return votes.get(questionId) ?? new Map<string, string>();
}

export function recordPollVote(questionId: string, userId: string, optionId: string) {
  const questionVotes = getPollVotes(questionId);
  if (questionVotes.has(userId)) return { accepted: false, optionId: questionVotes.get(userId)! };
  questionVotes.set(userId, optionId);
  votes.set(questionId, questionVotes);
  return { accepted: true, optionId };
}
