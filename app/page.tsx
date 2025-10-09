import DeckClient from '@/components/DeckClient';
import { getDeckSnapshot } from '@/lib/deckState';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const snapshot = await getDeckSnapshot();
  return <DeckClient initialData={snapshot} />;
}
