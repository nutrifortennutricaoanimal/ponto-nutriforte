import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autorizado." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user?.email) {
      return json({ error: "Sessão inválida." }, 401);
    }

    const { data: admin, error: adminError } = await supabaseUser
      .from("colaboradores")
      .select("id, is_admin, ativo")
      .eq("email", user.email)
      .single();

    if (adminError || !admin?.is_admin || !admin?.ativo) {
      return json({ error: "Acesso restrito ao administrador." }, 403);
    }

    const { email, senha } = await req.json();

    if (!email?.trim() || !senha || senha.length < 6) {
      return json({ error: "E-mail e senha (mín. 6 caracteres) são obrigatórios." }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRole);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: senha,
      email_confirm: true,
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ user_id: data.user.id }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
