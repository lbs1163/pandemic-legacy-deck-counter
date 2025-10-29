import { NextResponse } from 'next/server';
import { drawPlayerEvent } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const snapshot = await drawPlayerEvent();
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: '이벤트 카드 드로우에 실패했습니다.' },
      { status: 500 }
    );
  }
}

