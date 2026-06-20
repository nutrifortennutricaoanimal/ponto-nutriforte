import { format, parse, isValid } from "date-fns";

export const FORMATO_DATA = "dd/MM/yyyy";

export function formatarData(data) {
  const d = data instanceof Date ? data : parseData(data);
  return format(d, FORMATO_DATA);
}

export function dataHoje() {
  return formatarData(new Date());
}

export function parseData(valor) {
  if (valor instanceof Date) return valor;
  if (typeof valor !== "string" || !valor.trim()) {
    throw new Error("Data inválida.");
  }

  const limpo = valor.replace(/\D/g, "");

  if (limpo.length === 8) {
    const formatada = `${limpo.slice(0, 2)}/${limpo.slice(2, 4)}/${limpo.slice(4)}`;
    const d = parse(formatada, FORMATO_DATA, new Date());
    if (isValid(d)) return d;
  }

  const d = parse(valor.trim(), FORMATO_DATA, new Date());
  if (isValid(d)) return d;

  throw new Error("Data inválida. Use o formato DD/MM/YYYY.");
}

export function sanitizarEntradaData(valor) {
  const digits = valor.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function montarTimestamp(dataStr, horaStr) {
  const d = parseData(dataStr);
  const partes = (horaStr || "00:00").split(":").map(Number);
  d.setHours(partes[0] || 0, partes[1] || 0, 0, 0);
  return d.toISOString();
}

export function extrairHora(timestamp) {
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
