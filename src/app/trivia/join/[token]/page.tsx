import TriviaJoinPage from '@/components/trivia/trivia-join-page';

export default function JoinTriviaRoom({ params }: { params: { token: string } }) {
  return <TriviaJoinPage token={params.token} />;
}
