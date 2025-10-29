import { NextResponse } from 'next/server';
import { startNewGame } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const snapshot = await startNewGame();
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '새 게임을 시작하지 못했습니다.' },
      { status: 500 }
    );
  }
}

