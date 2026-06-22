-- Migration v3: adiciona coluna dias jsonb em jornadas
-- Executar no SQL Editor do Supabase

-- 1. Adiciona coluna
ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS dias jsonb;

-- 2. Migra dados existentes para o novo formato
-- Para cada jornada existente, monta o objeto dias a partir
-- das colunas antigas (hora_entrada, hora_saida, sabado, etc.)
UPDATE jornadas SET dias = jsonb_build_object(
  '0', jsonb_build_object('trabalha', false),
  '1', jsonb_build_object('trabalha', true, 'entrada', COALESCE(hora_entrada::text, '08:00'), 'saida', COALESCE(hora_saida::text, '17:00'), 'intervalo', COALESCE(intervalo_minutos, 60)),
  '2', jsonb_build_object('trabalha', true, 'entrada', COALESCE(hora_entrada::text, '08:00'), 'saida', COALESCE(hora_saida::text, '17:00'), 'intervalo', COALESCE(intervalo_minutos, 60)),
  '3', jsonb_build_object('trabalha', true, 'entrada', COALESCE(hora_entrada::text, '08:00'), 'saida', COALESCE(hora_saida::text, '17:00'), 'intervalo', COALESCE(intervalo_minutos, 60)),
  '4', jsonb_build_object('trabalha', true, 'entrada', COALESCE(hora_entrada::text, '08:00'), 'saida', COALESCE(hora_saida::text, '17:00'), 'intervalo', COALESCE(intervalo_minutos, 60)),
  '5', jsonb_build_object('trabalha', true, 'entrada', COALESCE(hora_entrada::text, '08:00'), 'saida', COALESCE(hora_saida::text, '17:00'), 'intervalo', COALESCE(intervalo_minutos, 60)),
  '6', CASE
    WHEN sabado = true THEN jsonb_build_object('trabalha', true, 'entrada', COALESCE(hora_entrada_sabado::text, '08:00'), 'saida', COALESCE(hora_saida_sabado::text, '12:00'), 'intervalo', 0)
    ELSE jsonb_build_object('trabalha', false)
  END
)
WHERE dias IS NULL;

-- Obs: as colunas antigas (hora_entrada, hora_saida, sabado, etc.)
-- são mantidas para compatibilidade. O app grava em ambas ao salvar.
