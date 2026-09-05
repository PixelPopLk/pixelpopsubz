import { createFileRoute } from "@tanstack/react-router";
import { supabase, SUBTITLES_TABLE } from "@/integrations/supabase/client";

const BASE_URL = "https://pixelpoplk.pages.dev";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Supabase වෙතින් සියලුම subtitles වල IDs සහ dates ලබා ගැනීම
        const { data: subtitles, error } = await supabase
          .from(SUBTITLES_TABLE)
          .select("id, created_at, updated_at, season, episode")
          .order("created_at", { ascending: false });

        if (error) {
          return new Response("Error generating sitemap", { status: 500 });
        }

        const now = new Date().toISOString().split("T")[0];

        // Static routes
        const staticUrls = [
          `  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
        ];

        // Dynamic Subtitles (Movies / Series / Episodes)
        const dynamicUrls = (subtitles ?? []).map((sub) => {
          const isEpisode = sub.season != null && sub.episode != null;
          const path = isEpisode ? `/episode/${sub.id}` : `/content/${sub.id}`;
          const lastmod = sub.updated_at
            ? new Date(sub.updated_at).toISOString().split("T")[0]
            : sub.created_at
            ? new Date(sub.created_at).toISOString().split("T")[0]
            : now;

          return `  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${isEpisode ? "0.7" : "0.9"}</priority>
  </url>`;
        });

        const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.join("\n")}
${dynamicUrls.join("\n")}
</urlset>`;

        return new Response(sitemapXml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
