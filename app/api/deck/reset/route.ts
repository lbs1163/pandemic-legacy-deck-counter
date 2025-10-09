import { NextResponse } from 'next/server';
import { resetDeckState } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const snapshot = await resetDeckState();
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '덱을 초기화할 수 없습니다.' },
      { status: 500 }
    );
  }
}
