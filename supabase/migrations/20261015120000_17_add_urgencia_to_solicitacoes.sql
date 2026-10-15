-- Adicionar coluna urgencia na tabela solicitacoes caso não exista
ALTER TABLE public.solicitacoes 
ADD COLUMN IF NOT EXISTS urgencia text DEFAULT 'nao_urgente';

-- Adicionar constraint de validação se ainda não existir
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

-- Atualizar registros existentes nulos
UPDATE public.solicitacoes 
SET urgencia = 'nao_urgente' 
WHERE urgencia IS NULL;

-- Criar índice para agilizar ordenação e filtragem por urgência
CREATE INDEX IF NOT EXISTS idx_solicitacoes_urgencia ON public.solicitacoes(urgencia);
