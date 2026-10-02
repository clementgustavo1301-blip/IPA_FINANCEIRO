-- 1. Adicionar o novo role 'empresa' (se não existir)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'empresa';

-- 2. Adicionar o campo empresa_cnpj na tabela user_roles para vincular o usuário à empresa
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS empresa_cnpj varchar(14);

-- 3. Inserir a empresa com o CNPJ solicitado se ela ainda não existir no banco
INSERT INTO public.empresas_clientes (cnpj, nome, razao_social)
VALUES ('64249971000152', 'Empresa Cliente', 'Empresa 64249971000152')
ON CONFLICT (cnpj) DO NOTHING;

-- 4. Dar acesso imediato de 'empresa' ao seu e-mail e vinculá-lo ao CNPJ
DO $$
DECLARE
    uid uuid;
BEGIN
    SELECT id INTO uid FROM auth.users WHERE email = 'clementgustavo1301@gmail.com' LIMIT 1;
    
    IF uid IS NOT NULL THEN
        -- Insere ou atualiza o papel do seu usuário para 'empresa', já aprovado
        INSERT INTO public.user_roles (user_id, role, status, empresa_cnpj)
        VALUES (uid, 'empresa', 'aprovado', '64249971000152')
        ON CONFLICT (user_id) DO UPDATE 
        SET role = 'empresa', status = 'aprovado', empresa_cnpj = '64249971000152';
    END IF;
END $$;

-- 5. Atualizar as regras de segurança (RLS) para que a Empresa só veja as solicitações dela
DROP POLICY IF EXISTS "Visibilidade de Solicitacoes" ON public.solicitacoes;

CREATE POLICY "Visibilidade de Solicitacoes" ON public.solicitacoes FOR SELECT TO authenticated USING (
  (public.get_my_role() = 'ipa') 
  or 
  (public.get_my_role() = 'financeiro' and status_ipa = 'Enviado')
  or 
  (public.get_my_role() = 'admin')
  or
  (public.get_my_role() = 'empresa' and empresa_cliente_id IN (
      SELECT id FROM public.empresas_clientes 
      WHERE cnpj = (SELECT empresa_cnpj FROM public.user_roles WHERE user_id = auth.uid())
  ))
);
