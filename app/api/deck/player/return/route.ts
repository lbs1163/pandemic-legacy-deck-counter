import { NextResponse } from 'next/server';
import { returnRemovedPlayerCityCard } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const city = typeof (body as any)?.city === 'string' ? (body as any).city.trim() : '';
    if (!city) {
      return NextResponse.json({ error: '도시 이름이 필요합니다.' }, { status: 400 });
    }
    const snapshot = await returnRemovedPlayerCityCard(city);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: '플레이어 도시 카드를 복구할 수 없습니다.' },
      { status: 500 }
    );
  }
}
