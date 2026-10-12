import { NextResponse } from 'next/server';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001';

export async function POST() {
  try {
    const res = await fetch(`${WHATSAPP_SERVICE_URL}/api/disconnect`, {
      method: 'POST',
      cache: 'no-store'
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || 'Erro ao desconectar do serviço WhatsApp'
    }, { status: 500 });
  }
}
