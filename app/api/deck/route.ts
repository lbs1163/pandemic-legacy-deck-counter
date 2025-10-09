import { NextResponse } from 'next/server';
import { getDeckSnapshot } from '@/lib/deckState';

export async function GET() {
  const snapshot = await getDeckSnapshot();
  return NextResponse.json(snapshot);
}
