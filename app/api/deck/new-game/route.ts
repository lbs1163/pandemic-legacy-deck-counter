import { NextResponse } from 'next/server';
import { startNewGame } from '@/lib/deckState';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const playersRaw = (body as any)?.players;
    const eventsRaw = (body as any)?.eventCount ?? (body as any)?.events;
    const players = Number.parseInt(String(playersRaw ?? ''), 10);
    const eventCount = Number.parseInt(String(eventsRaw ?? '0'), 10);
    const snapshot = await startNewGame({
      players: Number.isFinite(players) ? players : 4,
      eventCount: Number.isFinite(eventCount) ? eventCount : 4
    });
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
