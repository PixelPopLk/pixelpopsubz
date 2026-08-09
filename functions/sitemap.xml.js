// 🟢 Mirrors src/lib/subtitles.ts (parseTitle / isSeriesRow / buildGridItems)
// just enough to group rows the same way the app does, so the sitemap only
// ever lists real, unique, canonical URLs — one per movie, one per TV series
// "hub" page, plus one per individual episode. Keeping this logic in sync
// with generate-sitemap.js and src/lib/subtitles.ts if that grouping logic
// ever changes.
function cleanShowName(raw) {
  return raw
    .replace(/[._]+/g, " ")
    .replace(/\s+-\s+$/, "")
    .replace(/[\s\-:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTitle(title) {
  if (!title) return { showName: "" };

  let m = title.match(/^(.*?)[\s._-]*[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})(?:[\s._-]+(.+))?$/);
  if (m) return { showName: cleanShowName(m[1]), episode: { season: +m[2], episode: +m[3] } };

  m = title.match(/^(.*?)[\s._-]+Season[\s._-]?(\d{1,2})[\s._-]+Episode[\s._-]?(\d{1,3})(?:[\s._-]+(.+))?$/i);
  if (m) return { showName: cleanShowName(m[1]), episode: { season: +m[2], episode: +m[3] } };

  m = title.match(/^(.*?)[\s._-]+(\d{1,2})x(\d{1,3})(?:[\s._-]+(.+))?$/);
  if (m) return { showName: cleanShowName(m[1]), episode: { season: +m[2], episode: +m[3] } };

  m = title.match(/^(.*?)[\s._-]+(?:Episode|Epi|Ep)[\s._-]?(\d{1,3})(?:[\s._-]+(.+))?$/i);
  if (m) return { showName: cleanShowName(m[1]), episode: { season: 1, episode: +m[2] } };

  return { showName: title.trim() };
}

function num(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function isEpisodeRow(row) {
  const sNum = num(row.season);
  const eNum = num(row.episode);
  if (sNum != null && eNum != null) return true;

  const g = (row.genre ?? "").toLowerCase();
  if (g.split(/[,/|]/).map((x) => x.trim()).includes("movie")) return false;

  return parseTitle(row.title ?? "").episode != null;
}

function safeDate(value) {
  if (!value) return new Date().toISOString().split("T")[0];
  try {
    return new Date(value).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function buildSitemapEntries(rows, baseUrl) {
  const entries = [];
  const showLatest = new Map();

  for (const row of rows) {
    if (isEpisodeRow(row)) {
      entries.push({ loc: `${baseUrl}/episode/${row.id}`, lastmod: safeDate(row.created_at) });

      const key = parseTitle(row.title ?? "").showName.toLowerCase() || `id:${row.id}`;
      const existing = showLatest.get(key);
      if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
        showLatest.set(key, row);
      }
    } else {
      entries.push({ loc: `${baseUrl}/content/${row.id}`, lastmod: safeDate(row.created_at) });
    }
  }

  for (const row of showLatest.values()) {
    entries.push({ loc: `${baseUrl}/content/${row.id}`, lastmod: safeDate(row.created_at) });
  }

  return entries;
}

export async function onRequest(context) {
  // Cloudflare Environment Variables වලින් Keys අදිනවා
  const SUPABASE_URL = context.env.VITE_SUPABASE_URL || context.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = context.env.VITE_SUPABASE_ANON_KEY || context.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response("Missing Supabase credentials", { status: 500 });
  }

  try {
    // Supabase REST API එකෙන් Subtitles වල Data අදිනවා
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/subtitles?select=id,created_at,title,genre,season,episode&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!res.ok) {
      throw new Error(`Supabase error: ${res.status}`);
    }

    const subtitles = await res.json();
    const baseUrl = "https://pixelpoplk.pages.dev";

    const entries = buildSitemapEntries(subtitles, baseUrl);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Home Page
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    // 2. Movie / Series Hub / Episode Pages (Auto update වෙන කොටස)
    for (const entry of entries) {
      xml += `  <url>\n`;
      xml += `    <loc>${entry.loc}</loc>\n`;
      xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    });
  } catch (err) {
    return new Response("Failed to generate sitemap", { status: 500 });
  }
}
