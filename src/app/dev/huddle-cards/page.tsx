import { notFound } from 'next/navigation';

import HuddleCardGallery from '@/components/huddle/huddle-card-gallery';

export default function HuddleCardGalleryPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <HuddleCardGallery />;
}
