import { notFound } from 'next/navigation';

import SourceAdmin from '@/components/admin/source-admin';

export default function SourcesAdminPage() {
  if (process.env.NODE_ENV === 'production' && process.env.SOURCE_ADMIN_ENABLED !== 'true') {
    notFound();
  }
  return <SourceAdmin />;
}
