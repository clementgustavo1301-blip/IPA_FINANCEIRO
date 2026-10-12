import { NextResponse } from 'next/server';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001';

export async function GET() {
  try {
    const res = await fetch(`${WHATSAPP_SERVICE_URL}/api/config`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      daily_limit: 15,
      min_delay_sec: 20,
      max_delay_sec: 45,
      typing_speed_ms: 100,
      sent_today: 0,
      error: error.message
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${WHATSAPP_SERVICE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
