BEGIN;

-- 1. Limpar logs de auditoria
DELETE FROM public.audit_logs;

-- 2. Limpar colaboradores das solicitações
DELETE FROM public.colaboradores_solicitacao;

-- 3. Limpar as solicitações
DELETE FROM public.solicitacoes;

-- 4. Limpar empresas e clínicas
DELETE FROM public.empresas_clientes;
DELETE FROM public.clinicas;

-- 5. Limpar roles (cargos) de todos os usuários, EXCETO o seu
DELETE FROM public.user_roles 
WHERE user_id NOT IN (
    SELECT id FROM auth.users WHERE email = 'clementgustavo1301@gmail.com'
);

-- 6. Deletar todos os usuários da autenticação, EXCETO o seu
DELETE FROM auth.users 
WHERE email != 'clementgustavo1301@gmail.com';

COMMIT;
