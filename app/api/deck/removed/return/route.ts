import { NextResponse } from 'next/server';
import { returnRemovedInfectionCard } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const city = typeof (body as any)?.city === 'string' ? (body as any).city.trim() : '';
    const zone = (body as any)?.zone;

    if (!city) {
      return NextResponse.json({ error: '도시 이름이 필요합니다.' }, { status: 400 });
    }

    if (zone !== 'A' && zone !== 'B' && zone !== 'C') {
      return NextResponse.json({ error: '유효하지 않은 영역입니다.' }, { status: 400 });
    }

    const snapshot = await returnRemovedInfectionCard(city, zone);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '제거된 감염 카드를 복구하지 못했습니다.' },
      { status: 500 }
    );
  }
}
