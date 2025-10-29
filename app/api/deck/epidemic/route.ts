import { NextResponse } from 'next/server';
import { drawPlayerEpidemic } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const city = typeof body?.city === 'string' ? body.city : '';

    if (!city.trim()) {
      return NextResponse.json(
        { error: '도시 이름이 필요합니다.' },
        { status: 400 }
      );
    }

    const snapshot = await drawPlayerEpidemic(city);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '요청을 처리할 수 없습니다.' },
      { status: 500 }
    );
  }
}
