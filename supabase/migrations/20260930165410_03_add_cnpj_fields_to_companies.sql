-- Adicionando campos de pessoa jurídica na tabela clinicas
alter table public.clinicas
add column cnpj varchar(14) unique,
add column razao_social text,
add column cep varchar(8),
add column logradouro text,
add column numero varchar(20),
add column bairro text,
add column cidade text,
add column estado varchar(2),
add column telefone varchar(20),
add column email text;

-- Adicionando campos de pessoa jurídica na tabela empresas_clientes
alter table public.empresas_clientes
add column cnpj varchar(14) unique,
add column razao_social text,
add column cep varchar(8),
add column logradouro text,
add column numero varchar(20),
add column bairro text,
add column cidade text,
add column estado varchar(2),
add column telefone varchar(20),
add column email text;
