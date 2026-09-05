import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  Download,
  PlayCircle,
  Star,
  Subtitles,
  Tv,
  Share2,
  Check,
} from "lucide-react";

import { supabase, SUBTITLES_TABLE, type Subtitle } from "@/integrations/supabase/client";
import {
  buildGridItems,
  formatRating,
  genreBadgeClass,
  splitGenres,
  parseTitle, 
  type GridItem,
} from "@/lib/subtitles";
import { Navbar } from "@/components/Navbar";
import AdBanner from "@/components/AdBanner"; 
import { DownloadButton } from "@/components/DownloadCountdown";

const BASE_URL = "https://pixelpoplk.pages.dev";

// 🟢 SSR data loader — runs on the server so the real episode data is already
// present in the very first HTML response (crawlers never see a blank shell).
async function fetchEpisodeData(id: string): Promise<Subtitle[]> {
  const { data: targetItem, error: firstError } = await supabase
    .from(SUBTITLES_TABLE)
    .select("*")
    .eq("id", Number(id) as any)
    .maybeSingle();

  if (firstError) throw firstError;
  if (!targetItem) return [] as Subtitle[];

  const parsed = parseTitle(targetItem.title ?? "");
  const { data: allEpisodes, error: secondError } = await supabase
    .from(SUBTITLES_TABLE)
    .select("*")
    .ilike("title", `${parsed.showName}%`)
    .order("created_at", { ascending: false });

  if (secondError) throw secondError;
  return (allEpisodes ?? []) as Subtitle[];
}

function findEpisode(data: Subtitle[], id: string) {
  const items = buildGridItems(data);
  for (const it of items) {
    if (it.kind === "series") {
      const ep = it.episodes.find((e) => String(e.id) === id);
      if (ep) return { series: it, ep };
    }
  }
  return null;
}

// 🟢 head() runs server-side using the loader's data, so every episode gets its
// own unique, crawlable title / description / canonical / Open Graph tags.
function buildEpisodeHead({ loaderData, params }: { loaderData?: Subtitle[]; params: { id: string } }) {
  const found = findEpisode(loaderData ?? [], params.id);

  if (!found) {
    return { meta: [{ title: "Episode — PixelPopLK" }, { name: "robots", content: "noindex" }] };
  }

  const { series, ep } = found;
  const poster = ep.image_url || series.poster || "";
  const episodeTitle = ep.epTitle || `Episode ${String(ep.episode).padStart(2, "0")}`;
  const titleText = `${series.showName} S${String(ep.season).padStart(2, "0")}E${String(ep.episode).padStart(2, "0")} Sinhala Subtitle | ${episodeTitle} | PixelPopLK`;
  const descText = `Download Sinhala subtitle for ${series.showName} S${ep.season}E${ep.episode} (${episodeTitle}). High-quality Sinhala sub file synced on PixelPopLK.`;
  const keywordText = `${series.showName} S${ep.season}E${ep.episode} Sinhala Subtitle, ${series.showName} Season ${ep.season} Episode ${ep.episode} Sinhala Subtitle, Sinhala Subitiles TV Series, PixelPopLK, Sinhala Subtitles`;
  const canonicalUrl = `${BASE_URL}/episode/${ep.id}`;

  return {
    meta: [
      { title: titleText },
      { name: "description", content: descText },
      { name: "keywords", content: keywordText },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: titleText },
      { property: "og:description", content: descText },
      { property: "og:type", content: "video.episode" },
      { property: "og:url", content: canonicalUrl },
      ...(poster ? [{ property: "og:image", content: poster }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: titleText },
      { name: "twitter:description", content: descText },
      ...(poster ? [{ name: "twitter:image", content: poster }] : []),
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  };
}

export const Route = createFileRoute("/episode/$id")({
  loader: async ({ params: { id } }) => fetchEpisodeData(id),
  head: buildEpisodeHead,
  component: EpisodePage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <p className="text-destructive">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Episode not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          ← Back home
        </Link>
      </div>
    </div>
  ),
});

function EpisodeShareBar({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareUrl = typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "";
  const shareText = encodeURIComponent(`${title} Sinhala Subtitle | PixelPopLK`);

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 pt-4 border-t border-border/60">
      <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mr-2">
        <Share2 className="w-3.5 h-3.5" /> Share:
      </span>
      <a
        href={`https://api.whatsapp.com/send?text=${shareText}%20${shareUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-xs font-semibold transition flex items-center gap-1"
      >
        WhatsApp
      </a>
      <a
        href={`https://t.me/share/url?url=${shareUrl}&text=${shareText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 text-xs font-semibold transition flex items-center gap-1"
      >
        Telegram
      </a>
      <button
        onClick={handleCopy}
        type="button"
        className="px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted/80 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : null}
        {copied ? "Link Copied!" : "Copy Link"}
      </button>
    </div>
  );
}

function EpisodePage() {
  const { id } = Route.useParams();
  const data = Route.useLoaderData();
  const isLoading = false;

  const found = useMemo(() => {
    if (!data) return null;
    const items = buildGridItems(data);
    for (const it of items) {
      if (it.kind === "series") {
        const ep = it.episodes.find((e) => String(e.id) === id);
        if (ep) return { series: it, ep };
      }
    }
    return null;
  }, [data, id]);

  const series = found?.series;
  const ep = found?.ep;

  const genres = useMemo(() => (ep ? splitGenres(ep.genre) : []), [ep]);
  const rating = useMemo(() => (ep ? formatRating(ep.rating) : null), [ep]);
  const year = useMemo(() => {
    if (!ep) return "";
    return ep.year != null && ep.year !== ""
      ? String(ep.year)
      : new Date(ep.created_at).getFullYear().toString();
  }, [ep]);

  const poster = ep?.image_url || series?.poster || "";
  const episodeTitle = ep ? (ep.epTitle || `Episode ${String(ep.episode).padStart(2, "0")}`) : "";

  // 🟢 Google Search Star Rating (AggregateRating) ඇතුළත් Schema
  const episodeSchema = series && ep ? {
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    "name": episodeTitle,
    "episodeNumber": ep.episode,
    "partOfSeason": {
      "@type": "TVSeason",
      "seasonNumber": ep.season
    },
    "partOfSeries": {
      "@type": "TVSeries",
      "name": series.showName,
      "image": series.poster
    },
    "image": poster,
    "description": ep.description || `Sinhala subtitle for ${series.showName} Season ${ep.season} Episode ${ep.episode}`,
    ...(rating
      ? {
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": rating,
            "bestRating": "10",
            "ratingCount": "120"
          }
        }
      : {}),
    "workFeaturedBy": {
      "@type": "DataDownload",
      "name": `${series.showName} S${ep.season}E${ep.episode} Sinhala Subtitle`,
      "contentUrl": ep.download_link,
      "encodingFormat": "application/x-subrip",
      "description": `Download Sinhala Subtitle (.srt) for ${series.showName} Season ${ep.season} Episode ${ep.episode}`
    }
  } : null;

  return (
    <EpisodeShell>
      {isLoading ? (
        <div className="h-96 rounded-3xl bg-muted/30 animate-pulse" />
      ) : !data ? (
        <p>Loading…</p>
      ) : !found || !series || !ep ? (
        <div className="p-10 text-center text-destructive">Episode not found</div>
      ) : (
        <>
          {episodeSchema && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(episodeSchema) }}
            />
          )}
          
          <Link
            to="/content/$id"
            params={{ id: String(series.id) }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to {series.showName}
          </Link>

          <div className="relative overflow-hidden rounded-3xl border border-border shadow-card">
            {poster && (
              <div className="pointer-events-none absolute inset-0 opacity-30">
                <img
                  src={poster}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover blur-lg scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
              </div>
            )}
            <div className="relative grid md:grid-cols-[320px_1fr] gap-0">
              <div className="p-6 md:p-8 md:pr-0">
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-border shadow-card bg-muted">
                  {poster && (
                    <img
                      src={poster}
                      alt={ep.title}
                      // @ts-expect-error - fetchPriority is a valid DOM/HTML attribute
                      fetchPriority="high"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>
              <div className="p-6 sm:p-8 md:pl-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/15 text-primary text-xs font-semibold uppercase tracking-wide">
                    <Tv className="w-3 h-3" /> Episode
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card/70 border border-border text-[11px] font-semibold uppercase tracking-wide">
                    S{String(ep.season).padStart(2, "0")} · E{String(ep.episode).padStart(2, "0")}
                  </span>
                  {genres.map((g) => (
                    <span
                      key={g}
                      className={`px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide ${genreBadgeClass(g.toLowerCase())}`}
                    >
                      {g}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  {series.showName}
                </p>
                <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold leading-[1.1] tracking-tight">
                  {episodeTitle}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-foreground">{year}</span>
                  </span>
                  {rating && (
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-bold text-foreground">{rating}</span>
                      <span className="text-muted-foreground text-xs">/ 10 IMDb</span>
                    </span>
                  )}
                </div>

                {/* Overview Section */}
                {ep.description ? (
                  <div className="mt-6">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2">
                      Overview
                    </h3>
                    <p className="text-[15px] leading-relaxed text-foreground/85 whitespace-pre-line">
                      {ep.description}
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 p-4 rounded-xl bg-background/40 border border-border text-sm text-muted-foreground leading-relaxed">
                    High-quality Sinhala subtitle synced for the official release.
                  </div>
                )}

                {/* 🟢 Ad 1: Overview/Description එකට යටින් 300x250 Ad Banner එක */}
                <div className="my-4">
                  <AdBanner type="300x250" />
                </div>

                {/* Download Buttons Section */}
                <div className="mt-7 flex flex-col sm:flex-row gap-3" data-download-zone="true">
                  <DownloadButton downloadLink={ep.download_link} subtitleId={ep.id} label="Direct Download (.srt)" />
                  {(ep as any).telegram_link && (
                    <DownloadButton
                      downloadLink={(ep as any).telegram_link}
                      subtitleId={ep.id}
                      label="Telegram Download"
                      variant="telegram"
                    />
                  )}
                </div>
                
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Opens in a new tab. Thank you for supporting PixelPopLK ❤
                </p>

                {/* 🟢 Ad 2: Download Buttons වලට යටින් වෙනස් Size එකක (160x300) Ad Banner එක */}
                <div className="mt-5 flex justify-center w-full">
                  <AdBanner type="160x300" />
                </div>

                {/* Viral Share Bar */}
                <EpisodeShareBar title={`${series.showName} S${ep.season}E${ep.episode}`} />

              </div>
            </div>
          </div>

          <OtherEpisodes series={found.series} currentId={String(ep.id)} />
        </>
      )}
    </EpisodeShell>
  );
}

function OtherEpisodes({
  series,
  currentId,
}: {
  series: Extract<GridItem, { kind: "series" }>;
  currentId: string;
}) {
  const same = series.episodes
    .filter((e) => e.season === series.episodes.find((x) => String(x.id) === currentId)?.season)
    .sort((a, b) => a.episode - b.episode);
  if (same.length <= 1) return null;
  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
        <PlayCircle className="w-5 h-5 text-primary" /> More from this season
      </h2>
      <div className="grid sm:grid-cols-2 gap-2">
        {same.map((ep) => {
          const active = String(ep.id) === currentId;
          return (
            <Link
              key={String(ep.id)}
              to="/episode/$id"
              params={{ id: String(ep.id) }}
              className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                active
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-card/60 hover:border-primary/40"
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0 text-xs font-bold">
                {String(ep.episode).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {ep.epTitle || `Episode ${String(ep.episode).padStart(2, "0")}`}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{ep.title}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function EpisodeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar showBack backTo="/" backText="Home" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
