import { NextResponse } from 'next/server';
import { addCity } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const city = typeof body?.city === 'string' ? body.city.trim() : '';
    const countRaw = (body as any)?.count;
    const count = typeof countRaw === 'number' ? countRaw : Number.parseInt(String(countRaw), 10);
    const color = (body as any)?.color;

    if (!city) {
      return NextResponse.json(
        { error: '도시 이름이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(count) || count <= 0) {
      return NextResponse.json(
        { error: '감염 카드 장수는 1 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const colorOk = color === 'Red' || color === 'Blue' || color === 'Yellow' || color === 'Black' ? color : undefined;
    const snapshot = await addCity(city, Math.floor(count), colorOk);
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
