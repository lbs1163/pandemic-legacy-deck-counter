import { NextResponse } from 'next/server';
import { getGameSnapshot } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await getGameSnapshot();
  return NextResponse.json(snapshot);
}
