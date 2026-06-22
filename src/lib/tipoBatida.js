export const TIPOS_BATIDA = ["entrada", "intervalo_inicio", "intervalo_fim", "saida"];

export const TIPO_ICONES = {
  entrada: "🟢",
  intervalo_inicio: "➡️🍽️",
  intervalo_fim: "🍽️➡️",
  saida: "🔴",
};

export const TIPO_LABELS = {
  entrada: "Entrada",
  intervalo_inicio: "Início de intervalo",
  intervalo_fim: "Fim de intervalo",
  saida: "Saída",
};

export function labelTipoBatida(tipo) {
  return TIPO_LABELS[tipo] || tipo;
}

export function iconeTipoBatida(tipo) {
  return TIPO_ICONES[tipo] || "";
}

/** Texto com ícone + label (ex.: "🟢 Entrada") */
export function formatTipoBatida(tipo, { somenteIcone = false } = {}) {
  const icone = iconeTipoBatida(tipo);
  if (somenteIcone) return icone;
  const label = labelTipoBatida(tipo);
  return icone ? `${icone} ${label}` : label;
}
