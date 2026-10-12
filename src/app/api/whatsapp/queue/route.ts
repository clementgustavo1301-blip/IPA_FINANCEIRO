import { NextResponse } from 'next/server';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001';

export async function GET() {
  try {
    const res = await fetch(`${WHATSAPP_SERVICE_URL}/api/queue`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      items: [],
      sent_today: 0,
      daily_limit: 15,
      error: error.message
    });
  }
}

export async function POST() {
  try {
    const res = await fetch(`${WHATSAPP_SERVICE_URL}/api/queue`, {
      method: 'POST',
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
