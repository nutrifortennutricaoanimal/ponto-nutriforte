-- Ponto Nutriforte — executar no SQL Editor do Supabase

-- Locais de trabalho (começa vazia; admin cadastra pelo app)
CREATE TABLE locais_trabalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  raio_metros int NOT NULL DEFAULT 100,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Jornada padrão (editável pelo admin)
CREATE TABLE jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  hora_entrada time NOT NULL DEFAULT '08:00',
  hora_saida time NOT NULL DEFAULT '17:00',
  intervalo_minutos int NOT NULL DEFAULT 60,
  sabado boolean DEFAULT true,
  hora_entrada_sabado time DEFAULT '08:00',
  hora_saida_sabado time DEFAULT '12:00',
  dias_semana smallint[] DEFAULT '{1,2,3,4,5}',
  ativo boolean DEFAULT true
);

-- Calendário de exceções (feriados, dias extras, compensações)
CREATE TABLE calendario_dias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('feriado','dia_extra','compensacao')),
  jornada_id uuid REFERENCES jornadas(id),
  hora_entrada time,
  hora_saida time,
  observacao text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (data, jornada_id)
);

-- Colaboradores
CREATE TABLE colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  nome text NOT NULL,
  matricula text UNIQUE NOT NULL,
  jornada_id uuid REFERENCES jornadas(id),
  foto_url text,
  facial_descriptor jsonb,
  is_admin boolean DEFAULT false,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Registros de ponto
CREATE TABLE registros_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid REFERENCES colaboradores(id),
  tipo text CHECK (tipo IN ('entrada','saida','intervalo_inicio','intervalo_fim')),
  timestamp timestamptz DEFAULT now(),
  latitude numeric(10,7),
  longitude numeric(10,7),
  local_id uuid REFERENCES locais_trabalho(id),
  foto_capturada_url text,
  confianca_facial numeric(5,2),
  status text CHECK (status IN ('ok','fora_do_raio','falha_facial','manual')),
  observacao text,
  editado_em timestamptz,
  editado_por uuid REFERENCES colaboradores(id)
);

-- Histórico de criações/edições manuais
CREATE TABLE registros_ponto_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL REFERENCES registros_ponto(id) ON DELETE CASCADE,
  editado_por uuid REFERENCES colaboradores(id),
  editado_em timestamptz DEFAULT now(),
  acao text NOT NULL CHECK (acao IN ('criacao','edicao')),
  dados_anteriores jsonb,
  dados_novos jsonb NOT NULL,
  motivo text
);

-- RLS aberto por enquanto (dev)
ALTER TABLE locais_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendario_dias ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ponto_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open" ON locais_trabalho FOR ALL USING (true);
CREATE POLICY "open" ON jornadas FOR ALL USING (true);
CREATE POLICY "open" ON calendario_dias FOR ALL USING (true);
CREATE POLICY "open" ON colaboradores FOR ALL USING (true);
CREATE POLICY "open" ON registros_ponto FOR ALL USING (true);
CREATE POLICY "open" ON registros_ponto_historico FOR ALL USING (true);

-- Jornada padrão inicial
INSERT INTO jornadas (nome, dias_semana) VALUES ('Padrão', '{1,2,3,4,5,6}');

-- Storage: criar bucket "fotos-colaboradores" no Dashboard (público para leitura)
-- Funcionários: e-mail interno {matricula}@ponto.nutriforte.local (sem Auth)
-- Ponto: matrícula + GPS (sem reconhecimento facial)
