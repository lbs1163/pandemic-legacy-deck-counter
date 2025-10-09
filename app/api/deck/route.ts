import { NextResponse } from 'next/server';
import { getDeckSnapshot } from '@/lib/deckState';

export async function GET() {
  return NextResponse.json(getDeckSnapshot());
}
