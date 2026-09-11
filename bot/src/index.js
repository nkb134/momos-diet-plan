/**
 * Cloudflare Worker: Telegram webhook -> answer read commands from the live
 * site's plan.json, forward write commands to GitHub as a repository_dispatch.
 *
 * Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, GITHUB_TOKEN
 * Vars:    ALLOWED_USER_ID and/or ALLOWED_CHAT_ID (a group's negative id), GITHUB_REPO (owner/name), SITE_URL
 */
import { parseCommand, readReply, WRITE_COMMANDS } from './commands.mjs';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/setup') return setup(url, env);
    if (request.method === 'POST' && url.pathname === '/webhook') {
      if (request.headers.get('x-telegram-bot-api-secret-token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
      const update = await request.json().catch(() => null);
      ctx.waitUntil(handle(update, env));
      return new Response('ok');
    }
    return new Response('Momo\'s Diet Plan bot', { status: 200 });
  },
};

async function handle(update, env) {
  const msg = update?.message ?? update?.edited_message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;
  const fromOk = env.ALLOWED_USER_ID && String(msg.from?.id) === String(env.ALLOWED_USER_ID);
  const chatOk = env.ALLOWED_CHAT_ID && String(chatId) === String(env.ALLOWED_CHAT_ID);
  if (!fromOk && !chatOk) return send(env, chatId, `This bot is private. Your Telegram id is <code>${msg.from?.id}</code> and this chat's id is <code>${chatId}</code>. Set ALLOWED_USER_ID (just you) or ALLOWED_CHAT_ID (everyone in this chat) and redeploy.`);
  const parsed = parseCommand(msg.text);
  if (!parsed) return send(env, chatId, 'Send /help for the command list.');

  if (WRITE_COMMANDS.includes(parsed.command)) {
    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'momos-diet-plan-bot', 'content-type': 'application/json' },
      body: JSON.stringify({ event_type: 'bot-command', client_payload: { chat_id: chatId, message_id: msg.message_id, command: parsed.command, args: parsed.args, text: parsed.text } }),
    });
    return send(env, chatId, res.status === 204 ? `⏳ Working on /${parsed.command}… I'll reply when the validator has run (about a minute).` : `GitHub refused the request (${res.status}). Check the token.`);
  }

  const site = env.SITE_URL.replace(/\/?$/, '/');
  const [plan, index] = await Promise.all([
    fetch(`${site}plan.json`, { cf: { cacheTtl: 300 } }).then((r) => r.json()),
    fetch(`${site}search.json`, { cf: { cacheTtl: 300 } }).then((r) => r.json()),
  ]);
  return send(env, chatId, readReply(parsed, { plan, index, siteUrl: site }) ?? 'Hmm.');
}

async function send(env, chatId, text) {
  const chunks = text.match(/[\s\S]{1,3900}(?=\n|$)/g) ?? [text];
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  }
}

/** One-time: GET /setup?secret=<TELEGRAM_WEBHOOK_SECRET> registers this Worker as the bot's webhook. */
async function setup(url, env) {
  if (url.searchParams.get('secret') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  const hook = `${url.origin}/webhook`;
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: hook, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message', 'edited_message'], drop_pending_updates: true }),
  });
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setMyCommands`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ commands: [
      { command: 'today', description: "Today's meals and totals" }, { command: 'day', description: 'Meals for a day' }, { command: 'shop', description: 'Shopping list for a day or week' },
      { command: 'swap', description: 'Put a veg recipe on a day' }, { command: 'addon', description: 'Non-veg add-on on/off' }, { command: 'training', description: 'Set lift/swim/rest' },
      { command: 'out', description: 'Replace an ingredient everywhere' }, { command: 'recipes', description: 'Recipes for a slot' }, { command: 'help', description: 'All commands' },
    ] }),
  });
  return new Response(await r.text(), { headers: { 'content-type': 'application/json' } });
}
