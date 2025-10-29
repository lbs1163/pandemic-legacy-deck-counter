import { NextResponse } from 'next/server';
import { undoLastOperation } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const snapshot = await undoLastOperation();
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '되돌리기에 실패했습니다.' },
      { status: 500 }
    );
  }
}

