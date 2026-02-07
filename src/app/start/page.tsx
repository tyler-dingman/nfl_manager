import { redirect } from 'next/navigation';

export default function StartRedirect({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
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
  redirect(query ? `/teams?${query}` : '/teams');
}
