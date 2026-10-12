import { NextResponse } from 'next/server';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001';

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${WHATSAPP_SERVICE_URL}/api/qr`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        status: 'error',
        message: `Serviço retornou HTTP ${res.status}`
      }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      status: 'offline',
      message: 'Não foi possível se comunicar com o microserviço Go WhatsApp em ' + WHATSAPP_SERVICE_URL
    }, { status: 503 });
  }
}
