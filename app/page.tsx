import DeckClient from '@/components/DeckClient';
import { getDeckSnapshot } from '@/lib/deckState';

export default function HomePage() {
  const snapshot = getDeckSnapshot();
  return <DeckClient initialData={snapshot} />;
}
