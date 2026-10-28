// Envía un aviso push a todos los móviles del equipo cuando se añade una tarea.
// Llamada desde la app: POST { codigo, id }
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let body: { codigo?: string; id?: string };
  try { body = await req.json(); } catch { return json({ error: "body" }, 400); }
  const codigo = String(body.codigo ?? "").trim().toUpperCase();
  const id = String(body.id ?? "");
  if (!codigo || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "datos" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: cfg } = await sb.from("tareas_config").select("codigo, vapid_public, vapid_private").eq("id", 1).single();
  if (!cfg || cfg.codigo !== codigo) return json({ error: "codigo" }, 403);
  if (!cfg.vapid_public || !cfg.vapid_private) return json({ error: "sin_claves" }, 500);

  const { data: t } = await sb.from("tareas_tasks").select("*").eq("id", id).single();
  if (!t) return json({ error: "tarea" }, 404);
  // Solo se avisa de tareas recién creadas (evita reenvíos de tareas antiguas)
  if (Date.now() - new Date(t.creada).getTime() > 5 * 60 * 1000) return json({ enviados: 0, motivo: "antigua" });

  webpush.setVapidDetails("mailto:avisos@tareas-equipo.local", cfg.vapid_public, cfg.vapid_private);

  const { data: subs } = await sb.from("tareas_push_subs").select("*");
  const destinos = (subs ?? []).filter((s) => !t.dispositivo || s.dispositivo !== t.dispositivo);

  const [y, m, d] = String(t.fecha).split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
  const payload = JSON.stringify({
    title: "Nueva tarea" + (t.creada_por ? " de " + t.creada_por : ""),
    body: t.texto + " · " + dia + (t.para ? " · para " + t.para : ""),
    fecha: t.fecha,
    tag: "tarea-" + t.id,
  });

  let enviados = 0;
  const muertos: string[] = [];
  await Promise.all(destinos.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 * 12, urgency: "high" },
      );
      enviados++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) muertos.push(s.endpoint);
      else console.error("push error", code, String(e));
    }
  }));
  if (muertos.length) await sb.from("tareas_push_subs").delete().in("endpoint", muertos);

  return json({ enviados, eliminados: muertos.length });
});
