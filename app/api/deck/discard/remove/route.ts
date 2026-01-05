import { NextResponse } from 'next/server';
import { removeDiscardedInfectionCard } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const city = typeof (body as any)?.city === 'string' ? (body as any).city.trim() : '';
    if (!city) {
      return NextResponse.json(
        { error: '도시 이름이 필요합니다.' },
        { status: 400 }
      );
    }

    const snapshot = await removeDiscardedInfectionCard(city);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '버려진 감염 카드를 제거하지 못했습니다.' },
      { status: 500 }
    );
  }
}
