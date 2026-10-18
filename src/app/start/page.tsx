import { redirect } from 'next/navigation';

export default async function StartRedirect({
  searchParams: pendingSearchParams,
}: {
  searchParams?: Promise<Record<string, string | string[]>>;
}) {
  const searchParams = await pendingSearchParams;
  const params = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
      } else if (value) {
        params.set(key, value);
      }
    });
  }

  const query = params.toString();
  redirect(query ? `/offseasonmanager?${query}` : '/offseasonmanager');
}
