import { notFound } from 'next/navigation';
import BeatGallery from '@/components/beat/beat-gallery';
export default function BeatCardsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <BeatGallery />;
}
