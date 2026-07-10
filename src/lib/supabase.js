import { createClient } from "@supabase/supabase-js";

import { startOfDay, endOfDay, parseISO } from "date-fns";

import { parseData } from "./dates";
import { validarBatida, validarBatidaAdmin } from "./validacaoPonto";



const url = import.meta.env.VITE_SUPABASE_URL;

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;



if (!url || !anonKey) {

  console.error(

    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. " +

      "Copie .env.example para .env.local e preencha os valores."

  );

}



export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export function isTabelaInexistente(error) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = (error.message || "").toLowerCase();
  return msg.includes("could not find the table") || msg.includes("schema cache");
}

export const MSG_MIGRACAO_PENDENTE =
  "Execute o arquivo supabase/migration_v2.sql no SQL Editor do Supabase (Dashboard → SQL → New query).";



export async function getColaboradorByMatricula(matricula) {

  const { data, error } = await supabase

    .from("colaboradores")

    .select("*, jornadas(*)")

    .eq("matricula", matricula.trim())

    .eq("ativo", true)

    .maybeSingle();



  if (error) throw error;

  return data;

}



export async function getColaboradorById(id) {

  const { data, error } = await supabase

    .from("colaboradores")

    .select("*, jornadas(*)")

    .eq("id", id)

    .single();



  if (error) throw error;

  return data;

}



export async function getColaboradorByEmail(email) {

  const { data, error } = await supabase

    .from("colaboradores")

    .select("*, jornadas(*)")

    .eq("email", email)

    .maybeSingle();



  if (error) throw error;

  return data;

}



export async function getAdminColaborador() {

  const {

    data: { session },

  } = await supabase.auth.getSession();

  if (!session?.user?.email) return null;

  return getColaboradorByEmail(session.user.email);

}



export async function vincularUserId(colaboradorId, userId) {

  const { error } = await supabase

    .from("colaboradores")

    .update({ user_id: userId })

    .eq("id", colaboradorId)

    .is("user_id", null);



  if (error) throw error;

}



export async function getUltimoRegistroHoje(colaboradorId) {

  const hoje = new Date();

  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();

  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999).toISOString();



  const { data, error } = await supabase

    .from("registros_ponto")

    .select("*")

    .eq("colaborador_id", colaboradorId)

    .gte("timestamp", inicio)

    .lte("timestamp", fim)

    .order("timestamp", { ascending: false })

    .limit(1)

    .maybeSingle();



  if (error) throw error;
  return data;
}

export async function getRegistrosHoje(colaboradorId) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999).toISOString();

  const { data, error } = await supabase
    .from("registros_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .gte("timestamp", inicio)
    .lte("timestamp", fim)
    .order("timestamp", { ascending: true });

  if (error) throw error;
  return data || [];
}

import {
  TIPOS_BATIDA,
  TIPO_LABELS,
  TIPO_ICONES,
  formatTipoBatida,
  labelTipoBatida,
  iconeTipoBatida,
} from "./tipoBatida";

export {
  TIPOS_BATIDA,
  TIPO_LABELS,
  TIPO_ICONES,
  formatTipoBatida,
  labelTipoBatida,
  iconeTipoBatida,
};

export async function getRegistrosColaboradorDia(colaboradorId, dataRef) {
  const dia = dataRef instanceof Date ? dataRef : parseISO(dataRef);
  const inicio = startOfDay(dia).toISOString();
  const fim = endOfDay(dia).toISOString();

  const { data, error } = await supabase
    .from("registros_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .gte("timestamp", inicio)
    .lte("timestamp", fim)
    .order("timestamp", { ascending: true });

  if (error) throw error;
  return data || [];
}

export function proximoTipoPonto(ultimoRegistro) {
  if (!ultimoRegistro) return "entrada";
  const mapa = {
    entrada: "intervalo_inicio",
    intervalo_inicio: "intervalo_fim",
    intervalo_fim: "saida",
    saida: null,
  };
  return mapa[ultimoRegistro.tipo] ?? null;
}

export async function criarUsuarioAuth(email, senha) {
  const { data, error } = await supabase.functions.invoke("criar-usuario", {
    body: { email, senha },
  });

  if (error) throw new Error(error.message || "Erro ao criar usuário.");
  if (data?.error) throw new Error(data.error);
  if (!data?.user_id) throw new Error("Resposta inválida ao criar usuário.");

  return data.user_id;
}

export class RegistroBloqueadoError extends Error {
  constructor(tipo) {
    super(
      `Seu registro de ${labelTipoBatida(tipo)} já foi ajustado pelo administrador. Procure o RH em caso de dúvida.`
    );
    this.name = "RegistroBloqueadoError";
    this.tipo = tipo;
  }
}

export async function registrarPonto({
  colaboradorId,
  tipo,
  latitude,
  longitude,
  localId,
}) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999).toISOString();

  const { data: existentes, error: errCheck } = await supabase
    .from("registros_ponto")
    .select("id")
    .eq("colaborador_id", colaboradorId)
    .eq("tipo", tipo)
    .eq("status", "manual")
    .gte("timestamp", inicio)
    .lte("timestamp", fim)
    .limit(1);

  if (errCheck) throw errCheck;
  if (existentes?.length > 0) throw new RegistroBloqueadoError(tipo);

  const registros = await getRegistrosHoje(colaboradorId);
  validarBatida({ registros, tipo, timestamp: new Date() });

  const { data, error } = await supabase
    .from("registros_ponto")
    .insert({
      colaborador_id: colaboradorId,
      tipo,
      latitude,
      longitude,
      local_id: localId,
      status: "ok",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}



export async function buscarRegistrosPeriodo({ dataInicio, dataFim, colaboradorId }) {

  const inicio = startOfDay(parseData(dataInicio)).toISOString();

  const fim = endOfDay(parseData(dataFim)).toISOString();



  let query = supabase

    .from("registros_ponto")

    .select("*, colaborador:colaboradores!colaborador_id(nome, matricula, jornada_id, is_admin), locais_trabalho(nome)")

    .gte("timestamp", inicio)

    .lte("timestamp", fim)

    .order("timestamp", { ascending: true });



  if (colaboradorId) query = query.eq("colaborador_id", colaboradorId);



  const { data, error } = await query;

  if (error) throw error;

  return data || [];

}



export async function getJornadasMap() {

  const { data, error } = await supabase.from("jornadas").select("*");

  if (error) throw error;

  const map = {};

  for (const j of data || []) map[j.id] = j;

  return map;

}



export async function getCalendarioDias(dataInicio, dataFim) {

  const inicio = parseData(dataInicio);

  const fim = parseData(dataFim);

  const { data, error } = await supabase

    .from("calendario_dias")

    .select("*")

    .gte("data", inicio.toISOString().slice(0, 10))

    .lte("data", fim.toISOString().slice(0, 10))

    .order("data", { ascending: true });



  if (error) {
    if (isTabelaInexistente(error)) return [];
    throw error;
  }

  return data || [];
}

export async function salvarRegistroManual({

  modo,

  registroId,

  colaboradorId,

  tipo,

  timestamp,

  observacao,

  motivo,

  adminId,

}) {

  const registros = await getRegistrosColaboradorDia(colaboradorId, timestamp);
  validarBatidaAdmin({
    registros,
    tipo,
    timestamp,
    ignorarRegistroId: modo === "editar" ? registroId : undefined,
  });

  if (modo === "criar") {

    const payload = {

      colaborador_id: colaboradorId,

      tipo,

      timestamp,

      status: "manual",

      observacao: observacao || null,

    };



    const { data, error } = await supabase

      .from("registros_ponto")

      .insert(payload)

      .select()

      .single();



    if (error) throw error;



    await supabase.from("registros_ponto_historico").insert({

      registro_id: data.id,

      editado_por: adminId,

      acao: "criacao",

      dados_anteriores: null,

      dados_novos: data,

      motivo: motivo || null,

    });



    return data;

  }



  const { data: atual, error: errAtual } = await supabase

    .from("registros_ponto")

    .select("*")

    .eq("id", registroId)

    .single();



  if (errAtual) throw errAtual;



  const payload = {

    tipo,

    timestamp,

    status: "manual",

    observacao: observacao || null,

    editado_em: new Date().toISOString(),

    editado_por: adminId,

  };



  const { data, error } = await supabase

    .from("registros_ponto")

    .update(payload)

    .eq("id", registroId)

    .select()

    .single();



  if (error) throw error;



  await supabase.from("registros_ponto_historico").insert({

    registro_id: registroId,

    editado_por: adminId,

    acao: "edicao",

    dados_anteriores: atual,

    dados_novos: data,

    motivo: motivo || null,

  });



  return data;

}



export async function getHistoricoRegistro(registroId) {

  const { data, error } = await supabase

    .from("registros_ponto_historico")

    .select("*, admin:colaboradores!editado_por(nome)")

    .eq("registro_id", registroId)

    .order("editado_em", { ascending: false });



  if (error) {
    if (isTabelaInexistente(error)) return [];
    throw error;
  }

  return data || [];
}

export default supabase;

