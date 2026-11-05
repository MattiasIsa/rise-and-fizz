// Sends push notifications for reminders that are due. Called every minute by pg_cron.
// Secrets needed: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 1000).toISOString();
  const stale = new Date(now.getTime() - 6 * 3600 * 1000).toISOString();

  const { data: due, error } = await db
    .from('reminders')
    .select('id, user_id, project_id, culture_id, kind, title, detail, due_at')
    .is('done_at', null)
    .is('notified_at', null)
    .eq('notify', true)
    .lte('due_at', soon)
    .gte('due_at', stale)
    .limit(200);
  if (error) return new Response(error.message, { status: 500 });
  if (!due || due.length === 0) return Response.json({ sent: 0 });

  const userIds = [...new Set(due.map((r) => r.user_id))];
  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', userIds);
  const projectIds = [...new Set(due.map((r) => r.project_id).filter(Boolean))];
  const { data: projects } = projectIds.length
    ? await db.from('projects').select('id, name').in('id', projectIds)
    : { data: [] };
  const names = new Map((projects || []).map((p) => [p.id, p.name]));

  let sent = 0;
  for (const r of due) {
    const mine = (subs || []).filter((s) => s.user_id === r.user_id);
    const name = r.project_id ? names.get(r.project_id) : null;
    const payload = JSON.stringify({
      title: r.title,
      body: [name, r.detail].filter(Boolean).join(' · '),
      url: r.project_id ? `./#/p/${r.project_id}` : './#/cultures',
      tag: r.id
    });
    for (const s of mine) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
        else console.error('push failed', code, (e as Error).message);
      }
    }
    await db.from('reminders').update({ notified_at: now.toISOString() }).eq('id', r.id);
  }
  return Response.json({ sent, reminders: due.length });
});
