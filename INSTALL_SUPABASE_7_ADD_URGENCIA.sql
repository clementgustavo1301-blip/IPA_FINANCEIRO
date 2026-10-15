-- ==============================================================================
-- ATUALIZAÇÃO SGF: ADICIONAR NÍVEIS DE URGÊNCIA NAS SOLICITAÇÕES
-- ==============================================================================

-- 1. Adicionar coluna 'urgencia' na tabela 'solicitacoes'
ALTER TABLE public.solicitacoes 
ADD COLUMN IF NOT EXISTS urgencia text DEFAULT 'nao_urgente';

-- 2. Garantir constraint para os 3 níveis:
--    'urgente'     -> Urgente (Para hoje)
--    'media'       -> Média urgência (Para 2 dias)
--    'nao_urgente' -> Não urgente (Para 3 dias)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'solicitacoes_urgencia_check'
  ) THEN
    ALTER TABLE public.solicitacoes 
    ADD CONSTRAINT solicitacoes_urgencia_check 
    CHECK (urgencia IN ('urgente', 'media', 'nao_urgente'));
  END IF;
END $$;

-- 3. Preencher valores nulos com 'nao_urgente'
UPDATE public.solicitacoes 
SET urgencia = 'nao_urgente' 
WHERE urgencia IS NULL;

-- 4. Índice para indexar buscas e priorizações de urgência
CREATE INDEX IF NOT EXISTS idx_solicitacoes_urgencia ON public.solicitacoes(urgencia);
