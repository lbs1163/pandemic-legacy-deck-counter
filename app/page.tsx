import DeckClient from '@/components/DeckClient';
import { getDeckSnapshot } from '@/lib/deckState';

export default async function HomePage() {
  const snapshot = await getDeckSnapshot();
  return <DeckClient initialData={snapshot} />;
}
