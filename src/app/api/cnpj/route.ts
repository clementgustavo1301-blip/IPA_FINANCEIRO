import { NextResponse } from 'next/server';

interface NormalizedCnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  telefone: string;
  ddd_telefone_1: string;
  email: string;
  origem: string;
}

// 1. BrasilAPI
async function tryBrasilApi(cleanCnpj: string): Promise<NormalizedCnpjData | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.razao_social && !data.nome_fantasia) return null;

    const cepDigits = (data.cep || '').replace(/\D/g, '').slice(0, 8);
    const tel = data.ddd_telefone_1 || data.telefone || '';

    return {
      cnpj: cleanCnpj,
      razao_social: data.razao_social || data.nome_fantasia || '',
      nome_fantasia: data.nome_fantasia || data.razao_social || '',
      cep: cepDigits,
      logradouro: data.logradouro || '',
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      municipio: data.municipio || '',
      uf: (data.uf || '').slice(0, 2).toUpperCase(),
      telefone: tel,
      ddd_telefone_1: tel,
      email: data.email || '',
      origem: 'brasilapi'
    };
  } catch {
    return null;
  }
}

// 2. ReceitaWS
async function tryReceitaWs(cleanCnpj: string): Promise<NormalizedCnpjData | null> {
  try {
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
      signal: AbortSignal.timeout(4500),
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'ERROR' || (!data.nome && !data.fantasia)) return null;

    const cepDigits = (data.cep || '').replace(/\D/g, '').slice(0, 8);
    const tel = data.telefone || '';

    return {
      cnpj: cleanCnpj,
      razao_social: data.nome || data.fantasia || '',
      nome_fantasia: data.fantasia || data.nome || '',
      cep: cepDigits,
      logradouro: data.logradouro || '',
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      municipio: data.municipio || '',
      uf: (data.uf || '').slice(0, 2).toUpperCase(),
      telefone: tel,
      ddd_telefone_1: tel,
      email: data.email || '',
      origem: 'receitaws'
    };
  } catch {
    return null;
  }
}

// 3. CNPJ.ws Pública
async function tryCnpjWs(cleanCnpj: string): Promise<NormalizedCnpjData | null> {
  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`, {
      signal: AbortSignal.timeout(4500),
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.razao_social && !data.estabelecimento) return null;

    const est = data.estabelecimento || {};
    const cepDigits = (est.cep || '').replace(/\D/g, '').slice(0, 8);
    const tel = est.ddd1 && est.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : (est.telefone1 || '');
    const logradouroFull = [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' ');

    return {
      cnpj: cleanCnpj,
      razao_social: data.razao_social || est.nome_fantasia || '',
      nome_fantasia: est.nome_fantasia || data.razao_social || '',
      cep: cepDigits,
      logradouro: logradouroFull || '',
      numero: est.numero || '',
      complemento: est.complemento || '',
      bairro: est.bairro || '',
      municipio: est.cidade?.nome || '',
      uf: (est.estado?.sigla || '').slice(0, 2).toUpperCase(),
      telefone: tel,
      ddd_telefone_1: tel,
      email: est.email || '',
      origem: 'cnpjws'
    };
  } catch {
    return null;
  }
}

// 4. MinhaReceita
async function tryMinhaReceita(cleanCnpj: string): Promise<NormalizedCnpjData | null> {
  try {
    const res = await fetch(`https://minhareceita.org/${cleanCnpj}`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.razao_social && !data.nome_fantasia) return null;

    const cepDigits = (data.cep || '').toString().replace(/\D/g, '').slice(0, 8);
    const tel = data.ddd_telefone_1 || data.telefone || '';

    return {
      cnpj: cleanCnpj,
      razao_social: data.razao_social || data.nome_fantasia || '',
      nome_fantasia: data.nome_fantasia || data.razao_social || '',
      cep: cepDigits,
      logradouro: data.logradouro || '',
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      municipio: data.municipio || '',
      uf: (data.uf || '').slice(0, 2).toUpperCase(),
      telefone: tel,
      ddd_telefone_1: tel,
      email: data.email || '',
      origem: 'minhareceita'
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCnpj = searchParams.get('cnpj');

  if (!rawCnpj) {
    return NextResponse.json({ error: 'Parâmetro "cnpj" é obrigatório.' }, { status: 400 });
  }

  const cleanCnpj = rawCnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido. Digite 14 dígitos.' }, { status: 400 });
  }

  // Tentar os provedores em cascata (com timeouts de segurança)
  const result = 
    (await tryBrasilApi(cleanCnpj)) ||
    (await tryReceitaWs(cleanCnpj)) ||
    (await tryCnpjWs(cleanCnpj)) ||
    (await tryMinhaReceita(cleanCnpj));

  if (!result) {
    return NextResponse.json(
      { error: 'CNPJ não encontrado ou os serviços da Receita Federal estão temporariamente instáveis.' },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
