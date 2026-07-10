import { parseISO } from "date-fns";
import { labelTipoBatida, TIPOS_BATIDA } from "./tipoBatida";

const ORDEM_TIPOS = TIPOS_BATIDA;

export function mapaPorTipo(registros) {
  const map = {};
  for (const r of registros || []) {
    const existente = map[r.tipo];
    if (!existente || parseISO(r.timestamp) > parseISO(existente.timestamp)) {
      map[r.tipo] = r;
    }
  }
  return map;
}

export function tiposPermitidos(registros) {
  const m = mapaPorTipo(registros);

  if (m.saida) return [];
  if (!m.entrada) return ["entrada"];
  if (!m.intervalo_inicio) return ["intervalo_inicio", "saida"];
  if (!m.intervalo_fim) return ["intervalo_fim"];
  return ["saida"];
}

export function tipoSugerido(registros) {
  const permitidos = tiposPermitidos(registros);
  return permitidos[0] ?? null;
}

function tipoAnteriorObrigatorio(map, tipo) {
  if (tipo === "entrada") return null;
  if (!map.entrada) return "entrada";
  if (map.intervalo_inicio && !map.intervalo_fim) return "intervalo_fim";
  if (tipo === "intervalo_fim" && !map.intervalo_inicio) return "intervalo_inicio";
  return "entrada";
}

export class TipoDuplicadoError extends Error {
  constructor(tipo) {
    super(`Você já registrou ${labelTipoBatida(tipo)} hoje.`);
    this.name = "TipoDuplicadoError";
    this.tipo = tipo;
  }
}

export class SequenciaInvalidaError extends Error {
  constructor(tipoAnterior) {
    super(`Você precisa registrar ${labelTipoBatida(tipoAnterior)} antes.`);
    this.name = "SequenciaInvalidaError";
    this.tipoAnterior = tipoAnterior;
  }
}

export class DiaEncerradoError extends Error {
  constructor() {
    super("Seu ponto de hoje já foi encerrado com a saída.");
    this.name = "DiaEncerradoError";
  }
}

export class OrdemCronologicaError extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "OrdemCronologicaError";
  }
}

function validarEstruturaSequencia(map) {
  if (map.intervalo_inicio && !map.entrada) {
    throw new SequenciaInvalidaError("entrada");
  }
  if (map.intervalo_fim && !map.intervalo_inicio) {
    throw new SequenciaInvalidaError("intervalo_inicio");
  }
  if (map.saida && !map.entrada) {
    throw new SequenciaInvalidaError("entrada");
  }
  if (map.intervalo_inicio && !map.intervalo_fim && map.saida) {
    throw new SequenciaInvalidaError("intervalo_fim");
  }
}

function validarHorariosCrescentes(map) {
  for (let i = 0; i < ORDEM_TIPOS.length; i++) {
    for (let j = i + 1; j < ORDEM_TIPOS.length; j++) {
      const a = map[ORDEM_TIPOS[i]];
      const b = map[ORDEM_TIPOS[j]];
      if (!a || !b) continue;

      const tsA = parseISO(a.timestamp);
      const tsB = parseISO(b.timestamp);

      if (tsA >= tsB) {
        throw new OrdemCronologicaError(
          `Horário de ${labelTipoBatida(a.tipo)} (${formatHora(tsA)}) deve ser anterior a ${labelTipoBatida(b.tipo)} (${formatHora(tsB)}).`
        );
      }
    }
  }
}

function formatHora(date) {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Valida uma nova batida ou edição manual.
 * @param {object} opts
 * @param {Array} opts.registros - registros do dia (sem o registro ignorado)
 * @param {string} opts.tipo
 * @param {string|Date} opts.timestamp - ISO ou Date
 * @param {string} [opts.ignorarRegistroId] - ao editar, excluir o registro atual
 * @param {boolean} [opts.modoAdmin] - admin ignora trava de dia encerrado e sequência obrigatória
 */
export function validarBatida({ registros, tipo, timestamp, ignorarRegistroId, modoAdmin = false }) {
  const lista = (registros || []).filter((r) => r.id !== ignorarRegistroId);
  const map = mapaPorTipo(lista);

  if (map[tipo]) {
    throw new TipoDuplicadoError(tipo);
  }

  if (!modoAdmin) {
    const permitidos = tiposPermitidos(lista);
    if (!permitidos.includes(tipo)) {
      if (map.saida) throw new DiaEncerradoError();
      const anterior = tipoAnteriorObrigatorio(map, tipo);
      throw new SequenciaInvalidaError(anterior || "entrada");
    }
  }

  const tsNovo = timestamp instanceof Date ? timestamp : parseISO(timestamp);

  const mapComNovo = {
    ...map,
    [tipo]: { tipo, timestamp: tsNovo.toISOString() },
  };

  if (!modoAdmin) {
    validarEstruturaSequencia(mapComNovo);
  }
  validarHorariosCrescentes(mapComNovo);
}

export function isErroValidacaoPonto(err) {
  return (
    err instanceof TipoDuplicadoError ||
    err instanceof SequenciaInvalidaError ||
    err instanceof DiaEncerradoError ||
    err instanceof OrdemCronologicaError
  );
}
