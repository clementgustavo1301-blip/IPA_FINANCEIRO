import { NextResponse } from 'next/server';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, message, media_url, solicitacao_id } = body;

    if (!phone || !message) {
      return NextResponse.json({
        success: false,
        error: 'Campos "phone" e "message" são obrigatórios.'
      }, { status: 400 });
    }

    // Limpa caracteres especiais do telefone
    let cleanPhone = String(phone).replace(/\D/g, '');
    
    // Se não tiver DDI (55 para Brasil), adiciona
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s para envio com mídia

    const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message,
        media_url: media_url || undefined,
        solicitacao_id: solicitacao_id || undefined
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const result = await response.json();

    if (!response.ok || !result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || result.message || 'Falha ao enviar mensagem pelo WhatsApp'
      }, { status: response.status || 500 });
    }

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Erro ao enviar mensagem WhatsApp:', error);
    return NextResponse.json({
      success: false,
      error: error.name === 'AbortError' 
        ? 'Tempo limite esgotado ao contatar o serviço de WhatsApp.' 
        : error.message || 'Erro interno no servidor'
    }, { status: 500 });
  }
}
