const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.ffglooxeupimfnlctizu:IPAFINANCEIRO@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase...');
    const res = await client.query("UPDATE public.user_roles SET status = 'aprovado' WHERE role = 'ipa'");
    console.log('Sucesso! Linhas atualizadas:', res.rowCount);
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

run();
