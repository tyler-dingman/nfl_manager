import TriviaJoinPage from '@/components/trivia/trivia-join-page';

export default async function JoinTriviaRoom({ params: asyncparams }: { params: Promise<{ token: string }> }) {
const params = await asyncparams;

  return <TriviaJoinPage token={params.token} />;
}
