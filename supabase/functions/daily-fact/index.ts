// Asks Claude for a fun fact or quiz question based on the user's own fermentation data.
// Called by the app ("New fact" / "Quiz me", with the user's login) and once a day by pg_cron (with CRON_SECRET).
// Secrets: ANTHROPIC_API_KEY (function secret); cron_secret lives in Vault, read through rf_secret().
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
let cronSecret = '';
async function getCronSecret() {
  if (!cronSecret) { const { data } = await admin.rpc('rf_secret', { secret_name: 'cron_secret' }); cronSecret = (data as string) || ''; }
  return cronSecret;
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function summarise(userId: string) {
  const { data: projects } = await admin.from('projects')
    .select('type, name, status, stage, specs, result, rating, started_at, finished_at')
    .eq('user_id', userId).order('started_at', { ascending: false }).limit(25);
  const { data: cultures } = await admin.from('cultures').select('kind, name, location, born_on').eq('user_id', userId);
  const { data: recent } = await admin.from('facts').select('text').eq('user_id', userId).order('created_at', { ascending: false }).limit(8);
  const slim = (projects || []).map((p) => ({
    type: p.type, name: p.name, status: p.status, stage: p.stage, rating: p.rating, started: p.started_at?.slice(0, 10),
    temp: p.specs?.temp, water: p.specs?.water, flours: p.specs?.flours, starter: p.specs?.starter, salt: p.specs?.salt,
    retardHours: p.result?.retardHours ?? p.specs?.retardHours, bulkMinutes: p.result?.bulkMinutes, rise: p.result?.measuredRise,
    volume: p.specs?.volume, tea: p.specs?.tea, f1Days: p.specs?.f1Days, f2Days: p.specs?.f2Days, flavors: p.specs?.flavors, fizz: p.result?.fizz
  }));
  return { projects: slim, cultures: cultures || [], avoid: (recent || []).map((f) => f.text) };
}

async function askClaude(kind: string, data: unknown) {
  const instruction = kind === 'quiz'
    ? 'Write one fun multiple-choice quiz question about sourdough or kombucha (about their own bakes or batches if the data allows). Reply with JSON only, no other text: {"q": "question", "options": ["3 or 4 short options"], "answer": index of the correct option, "explain": "one short sentence on why"}. Exactly one option is correct; the others must be plausible but wrong.'
    : 'Write one short, interesting fact or insight. Prefer a real pattern in their own data (cite their numbers). If there is too little data, give a surprising general fermentation fact instead.';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 400,
      system: 'You write the "Fact of the day" card in a home sourdough and kombucha tracking app. Be accurate, warm and playful. Maximum 40 words (quiz question plus options may use up to 60). Metric units. No markdown, no emoji. Never repeat anything in the "avoid" list. Do not invent data the user did not log.',
      messages: [{ role: 'user', content: `${instruction}\n\nTheir data (JSON):\n${JSON.stringify(data)}` }]
    })
  });
  if (!res.ok) throw new Error('Claude API error ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const json = await res.json();
  const text = (json.content || []).map((c: { text?: string }) => c.text || '').join('').trim();
  if (kind !== 'quiz') return text;
  // Quizzes are stored as JSON so the app can show tappable options.
  const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const q = JSON.parse(raw);
  if (!q.q || !Array.isArray(q.options) || q.options.length < 2 || !(q.answer >= 0 && q.answer < q.options.length)) throw new Error('Bad quiz from Claude');
  return JSON.stringify({ q: String(q.q), options: q.options.map(String).slice(0, 4), answer: Number(q.answer), explain: String(q.explain || '') });
}

async function factFor(userId: string, kind: string) {
  const text = await askClaude(kind, await summarise(userId));
  const { data, error } = await admin.from('facts').insert({ user_id: userId, kind, text }).select().single();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const kind = body.kind === 'quiz' ? 'quiz' : 'fact';

    // Daily run for everyone who has logged something.
    const given = req.headers.get('x-cron-secret');
    if (given && given === (await getCronSecret())) {
      const { data: users } = await admin.from('projects').select('user_id');
      const ids = [...new Set((users || []).map((u) => u.user_id))];
      let made = 0;
      for (const id of ids) { try { await factFor(id, 'fact'); made++; } catch (e) { console.error(id, e); } }
      return Response.json({ made });
    }

    // On demand from the app, as the signed-in user.
    const auth = req.headers.get('Authorization') || '';
    const userClient = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response('sign in first', { status: 401, headers: cors });
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await admin.from('facts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
    if ((count || 0) >= 20) return new Response('Easy there! Try again in a bit.', { status: 429, headers: cors });
    const fact = await factFor(user.id, kind);
    return Response.json(fact, { headers: cors });
  } catch (e) {
    console.error(e);
    return new Response(String((e as Error).message || e), { status: 500, headers: cors });
  }
});
