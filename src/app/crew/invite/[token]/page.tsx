import CrewInvitePage from '@/components/crew/crew-invite-page';
export default function Page({ params }: { params: { token: string } }) {
  return <CrewInvitePage token={params.token} />;
}
