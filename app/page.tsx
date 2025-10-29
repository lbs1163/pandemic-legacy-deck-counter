import DeckClient from '@/components/DeckClient';
import { getGameSnapshot } from '@/lib/deckState';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const snapshot = await getGameSnapshot();
  return <DeckClient initialData={snapshot} />;
}
