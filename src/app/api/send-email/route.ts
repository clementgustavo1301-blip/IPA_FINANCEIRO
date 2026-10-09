import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// O Resend automaticamente pega a variável de ambiente RESEND_API_KEY se não passarmos nada, 
// mas é bom deixar explícito.
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, html } = body;

    if (!to) {
      return NextResponse.json({ error: 'O campo "to" (destinatário) é obrigatório.' }, { status: 400 });
    }

    const data = await resend.emails.send({
      // onboarding@resend.dev é o email padrão de teste do Resend. 
      // Ele só permite enviar para o próprio email que você usou para criar a conta no Resend.
      // Quando tiver um domínio próprio configurado, mude aqui.
      from: 'Sistema Financeiro <onboarding@resend.dev>', 
      to: [to],
      subject: subject || 'Notificação - Teste do Sistema',
      html: html || '<p>Olá! Este é um <strong>email de teste</strong> do seu Sistema Financeiro.</p>',
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao enviar email' }, 
      { status: 500 }
    );
  }
}
