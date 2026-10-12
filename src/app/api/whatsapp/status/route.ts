import { NextResponse } from 'next/server';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001';

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${WHATSAPP_SERVICE_URL}/api/status`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({
        service_online: false,
        connected: false,
        status: 'error',
        message: `Serviço retornou status HTTP ${res.status}`
      });
    }

    const data = await res.json();
    return NextResponse.json({
      service_online: true,
      ...data
    });
  } catch (error: any) {
    return NextResponse.json({
      service_online: false,
      connected: false,
      status: 'offline',
      message: 'Microserviço WhatsApp Go não está respondendo em ' + WHATSAPP_SERVICE_URL
    });
  }
}
