#!/usr/bin/env node
/**
 * Hydrate `tweets` placeholders in a feed card from a raw X API
 * get_posts_by_ids response (expansions=author_id,attachments.media_keys).
 *
 *   node scripts/hydrate-tweets.mjs --raw raw.json --card <card-id> [--feed data/feed.json]
 *
 * Every sections[].tweets[] entry that has an `id` or `url` is replaced with
 * the full card shape (see docs-internal/builders-post-format.md). Posts the
 * API did not return become link-only fallbacks `{ id, url, author: { username } }`.
 * Writes the feed in place and prints a summary.
 */
import { readFileSync, writeFileSync } from "node:fs";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

const rawPath = arg("raw");
const cardId = arg("card");
const feedPath = arg("feed", "data/feed.json");
if (!rawPath || !cardId) {
  console.error("usage: --raw <api.json> --card <card-id> [--feed data/feed.json]");
  process.exit(2);
}

const idFromUrl = (u) => (String(u || "").match(/status\/(\d+)/) || [])[1];
const userFromUrl = (u) => (String(u || "").match(/x\.com\/([A-Za-z0-9_]{1,15})\/status/) || [])[1];

export function toTweet(post, includes = {}) {
  const users = new Map((includes.users || []).map((u) => [u.id, u]));
  const media = new Map((includes.media || []).map((m) => [m.media_key, m]));
  const u = users.get(post.author_id) || {};
  const ents = post.entities || {};
  const urls = (ents.urls || []).filter((x) => !x.media_key);
  const mediaTco = (ents.urls || []).find((x) => x.media_key)?.url;
  let text = post.note_tweet?.text || post.text || "";
  // Leading @mentions on a reply render as "Replying to @x" (like X).
  const lead = text.match(/^((?:@[A-Za-z0-9_]{1,15}\s+)+)/);
  const replyTo = lead ? lead[1].trim().split(/\s+/).map((h) => h.slice(1)) : undefined;
  if (lead) text = text.slice(lead[1].length);
  if (mediaTco) text = text.replace(new RegExp(`\\s*${mediaTco.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "");
  // Truncated quote/link t.co at the end of a note_tweet's short text is dropped by X.
  const pm = post.public_metrics || {};
  return {
    id: post.id,
    url: post.url || `https://x.com/${u.username}/status/${post.id}`,
    author: {
      name: u.name,
      username: u.username,
      avatar: u.profile_image_url,
      verified: Boolean(u.verified),
      verified_type: u.verified_type || (u.verified ? "blue" : "none"),
    },
    created_at: post.created_at,
    text: text.trim(),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(urls.length
      ? { urls: urls.map(({ url, expanded_url, display_url }) => ({ url, expanded_url, display_url })) }
      : {}),
    media: (post.attachments?.media_keys || [])
      .map((k) => media.get(k))
      .filter(Boolean)
      .map((m) => ({
        type: m.type,
        url: m.url || m.preview_image_url,
        ...(m.preview_image_url ? { preview_image_url: m.preview_image_url } : {}),
        width: m.width,
        height: m.height,
        ...(m.alt_text ? { alt_text: m.alt_text } : {}),
      })),
    public_metrics: {
      reply_count: pm.reply_count || 0,
      repost_count: pm.repost_count ?? pm.retweet_count ?? 0,
      quote_count: pm.quote_count || 0,
      like_count: pm.like_count || 0,
      impression_count: pm.impression_count || 0,
    },
  };
}

const raw = JSON.parse(readFileSync(rawPath, "utf8"));
const byId = new Map((raw.data || []).map((p) => [p.id, toTweet(p, raw.includes)]));
const feed = JSON.parse(readFileSync(feedPath, "utf8"));
const card = (feed.cards || []).find((c) => c.id === cardId);
if (!card) {
  console.error(`card not found: ${cardId}`);
  process.exit(1);
}
let ok = 0;
let fallback = 0;
for (const s of card.detail?.sections || []) {
  if (!Array.isArray(s.tweets)) continue;
  s.tweets = s.tweets.slice(0, 3).map((t) => {
    const id = t.id || idFromUrl(t.url);
    const full = byId.get(id);
    if (full) {
      ok++;
      return full;
    }
    fallback++;
    return { id, url: t.url || `https://x.com/i/status/${id}`, author: { username: t.author?.username || userFromUrl(t.url) } };
  });
}
writeFileSync(feedPath, JSON.stringify(feed, null, 2) + "\n");
console.log(`hydrated ${ok} tweet card(s), ${fallback} link fallback(s) in ${cardId}`);
