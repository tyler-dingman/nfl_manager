import CrewInvitePage from '@/components/crew/crew-invite-page';
export default async function Page({ params: asyncparams }: { params: Promise<{ token: string }> }) {
const params = await asyncparams;

  return <CrewInvitePage token={params.token} />;
}
