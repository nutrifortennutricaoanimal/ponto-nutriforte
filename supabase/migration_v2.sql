-- Migração v2 — executar no SQL Editor do Supabase
-- Dashboard: https://supabase.com/dashboard → seu projeto → SQL → New query → Run

-- 1. Dias da semana na jornada
ALTER TABLE jornadas
  ADD COLUMN IF NOT EXISTS dias_semana smallint[] DEFAULT '{1,2,3,4,5}';

UPDATE jornadas
SET dias_semana = CASE
  WHEN sabado THEN ARRAY[1,2,3,4,5,6]::smallint[]
  ELSE ARRAY[1,2,3,4,5]::smallint[]
END
WHERE dias_semana IS NULL OR dias_semana = '{}';

-- 2. Calendário de exceções (feriados, dias extras)
CREATE TABLE IF NOT EXISTS calendario_dias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('feriado','dia_extra','compensacao')),
  jornada_id uuid REFERENCES jornadas(id),
  hora_entrada time,
  hora_saida time,
  observacao text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS calendario_dias_data_jornada_idx
  ON calendario_dias (data, COALESCE(jornada_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE calendario_dias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open" ON calendario_dias;
CREATE POLICY "open" ON calendario_dias FOR ALL USING (true);

-- 3. Auditoria de registros (edição manual)
ALTER TABLE registros_ponto
  ADD COLUMN IF NOT EXISTS editado_em timestamptz,
  ADD COLUMN IF NOT EXISTS editado_por uuid REFERENCES colaboradores(id);

CREATE TABLE IF NOT EXISTS registros_ponto_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL REFERENCES registros_ponto(id) ON DELETE CASCADE,
  editado_por uuid REFERENCES colaboradores(id),
  editado_em timestamptz DEFAULT now(),
  acao text NOT NULL CHECK (acao IN ('criacao','edicao')),
  dados_anteriores jsonb,
  dados_novos jsonb NOT NULL,
  motivo text
);

ALTER TABLE registros_ponto_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open" ON registros_ponto_historico;
CREATE POLICY "open" ON registros_ponto_historico FOR ALL USING (true);
