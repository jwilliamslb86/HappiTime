// supabase/functions/notify-upcoming-happy-hours/index.ts
//
// Sends Expo push notifications to users who have saved venues with happy
// hours starting within the next 60 minutes.
//
// Invoke via pg_cron or Supabase scheduled function (every 30 min):
//   SELECT cron.schedule('notify-hh', '*/30 * * * *',
//     $$SELECT net.http_post(url := '...', headers := ..., body := ...)$$);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const LOOKAHEAD_MINUTES = 60;
const BATCH_SIZE = 100;

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
};

Deno.serve(async (req) => {
  // Allow manual triggers via POST; scheduled invocations also POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  // Current time in HH:MM format for time-window comparison
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const lookaheadTime = new Date(now.getTime() + LOOKAHEAD_MINUTES * 60_000);
  const lookaheadStr = `${pad(lookaheadTime.getHours())}:${pad(lookaheadTime.getMinutes())}`;
  const todayDow = now.getDay(); // 0=Sun … 6=Sat

  // Find published windows starting in the next LOOKAHEAD_MINUTES
  const { data: windows, error: winErr } = await supabase
    .from("happy_hour_windows")
    .select("id, venue_id, start_time, label, venue:venues(name)")
    .eq("status", "published")
    .gte("start_time", currentTime)
    .lte("start_time", lookaheadStr)
    .contains("dow", [todayDow]);

  if (winErr) {
    console.error("[notify] window fetch failed:", winErr.message);
    return new Response(JSON.stringify({ error: winErr.message }), { status: 500 });
  }

  if (!windows || windows.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no upcoming windows" }));
  }

  const venueIds = [...new Set(windows.map((w: any) => w.venue_id).filter(Boolean))];

  // Find users who follow these venues and have push tokens
  const { data: tokenRows, error: tokenErr } = await supabase
    .from("user_followed_venues")
    .select(`
      user_id,
      venue_id,
      token:user_push_tokens!inner(expo_push_token)
    `)
    .in("venue_id", venueIds);

  if (tokenErr) {
    console.error("[notify] token fetch failed:", tokenErr.message);
    return new Response(JSON.stringify({ error: tokenErr.message }), { status: 500 });
  }

  if (!tokenRows || tokenRows.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no tokens for followed venues" }));
  }

  // Build one message per user per venue window
  const messages: ExpoPushMessage[] = [];
  const venueWindowMap = new Map<string, typeof windows[0]>();
  for (const w of windows as any[]) {
    venueWindowMap.set(w.venue_id, w);
  }

  for (const row of tokenRows as any[]) {
    const token = row.token?.expo_push_token;
    if (!token || !token.startsWith("ExponentPushToken")) continue;

    const window = venueWindowMap.get(row.venue_id);
    if (!window) continue;

    const venueName = (window.venue as any)?.name ?? "a saved venue";
    const label = window.label ? ` – ${window.label}` : "";
    const startTime = window.start_time.slice(0, 5); // HH:MM

    messages.push({
      to: token,
      title: `🍹 Happy hour starting at ${startTime}`,
      body: `${venueName}${label} starts soon`,
      sound: "default",
      data: { venueId: row.venue_id, windowId: window.id }
    });
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no valid tokens" }));
  }

  // Send in batches of BATCH_SIZE (Expo limit is 100/request)
  let totalSent = 0;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch)
    });
    if (res.ok) totalSent += batch.length;
    else console.error("[notify] expo push failed:", await res.text());
  }

  return new Response(JSON.stringify({ sent: totalSent }), {
    headers: { "Content-Type": "application/json" }
  });
});
