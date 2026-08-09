import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import AdBanner from "@/components/AdBanner";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Download,
  Film,
  PlayCircle,
  Star,
  Subtitles,
  Tv,
  MessageSquare,
  Trash2,
  Send,
  Loader2,
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
import { DownloadButton } from "@/components/DownloadCountdown";

// 🟢 Canonical links සෑදීම සඳහා Base URL එක මෙතැනින් ලබා දෙනවා
const BASE_URL = "https://pixelpoplk.pages.dev";

// 🟢 SSR data loader — this runs on the SERVER before the page is sent to the
// browser (or to Googlebot). Because the real content is already fetched here,
// the very first HTML response contains the full movie/series details instead
// of a loading skeleton, which is essential for search engine indexing.
async function fetchContentData(id: string): Promise<Subtitle[]> {
  const { data: targetItem, error: firstError } = await supabase
    .from(SUBTITLES_TABLE)
    .select("*")
    .eq("id", Number(id) as any)
    .maybeSingle();

  if (firstError) throw firstError;
  if (!targetItem) return [] as Subtitle[];

  const isSeries = (() => {
    const sNum = targetItem.season;
    const eNum = targetItem.episode;
    if (sNum != null && eNum != null) return true;

    const g = (targetItem.genre ?? "").toLowerCase();
    const genresList = g.split(/[,/|]/).map((x) => x.trim());
    if (genresList.includes("movie")) return false;

    const parsed = parseTitle(targetItem.title ?? "");
    return parsed.episode != null;
  })();

  if (isSeries) {
    const parsed = parseTitle(targetItem.title ?? "");
    const { data: allEpisodes, error: secondError } = await supabase
      .from(SUBTITLES_TABLE)
      .select("*")
      .ilike("title", `${parsed.showName}%`)
      .order("created_at", { ascending: false });

    if (secondError) throw secondError;
    return (allEpisodes ?? []) as Subtitle[];
  }

  return [targetItem] as Subtitle[];
}

function findItem(data: Subtitle[], id: string): GridItem | null {
  const items = buildGridItems(data);
  const direct = items.find((it) => String(it.id) === id);
  if (direct) return direct;
  for (const it of items) {
    if (it.kind === "series" && it.episodes.some((e) => String(e.id) === id)) return it;
  }
  return null;
}

// 🟢 head() also runs on the server, using the data the loader already fetched,
// so crawlers get the real per-page <title>, description, canonical link and
// Open Graph tags on the FIRST response — not injected later by client JS.
function buildContentHead({ loaderData, params }: { loaderData?: Subtitle[]; params: { id: string } }) {
  const item = findItem(loaderData ?? [], params.id);

  if (!item) {
    return { meta: [{ title: "Subtitle — PixelPopLK" }, { name: "robots", content: "noindex" }] };
  }

  if (item.kind === "movie") {
    const s = item.sub;
    const year = s.year != null && s.year !== "" ? String(s.year) : new Date(s.created_at).getFullYear().toString();
    const titleText = `${s.title} (${year}) Sinhala Subtitle | Download Movie Subtitles | PixelPopLK`;
    const descText = s.description
      ? s.description.slice(0, 160)
      : `Download Sinhala subtitles for ${s.title} (${year}). High-quality Sinhala sub file synced for official release. Fast & secure on PixelPopLK.`;
    const customMeta = (s as any).metatags;
    const keywordText = customMeta
      ? `${s.title} Sinhala Subtitle, ${customMeta}`
      : `${s.title} Sinhala Subtitle, Download ${s.title} Subtitle, PixelPopLK, Sinhala Subtitles, Movie Subtitles`;
    const canonicalUrl = `${BASE_URL}/content/${s.id}`;

    return {
      meta: [
        { title: titleText },
        { name: "description", content: descText },
        { name: "keywords", content: keywordText },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: titleText },
        { property: "og:description", content: descText },
        { property: "og:type", content: "video.movie" },
        { property: "og:url", content: canonicalUrl },
        ...(s.image_url ? [{ property: "og:image", content: s.image_url }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: titleText },
        { name: "twitter:description", content: descText },
        ...(s.image_url ? [{ name: "twitter:image", content: s.image_url }] : []),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  }

  // TV series hub page
  const s1e1 = item.episodes.find((e) => e.season === 1 && e.episode === 1) || item.episodes[0];
  const withYear = item.episodes.find((e) => e.year != null && e.year !== "") ?? item.episodes[0];
  const year =
    withYear?.year != null && withYear.year !== ""
      ? String(withYear.year)
      : new Date(item.latestDate).getFullYear().toString();
  const description = s1e1?.description ?? null;
  const titleText = `${item.showName} Sinhala Subtitles | TV Series Download | PixelPopLK`;
  const descText = description
    ? description.slice(0, 160)
    : `Download Sinhala subtitles for TV Series ${item.showName} (${year}). Latest seasons and episodes available on PixelPopLK.`;
  const customMeta = item.episodes.map((e) => (e as any).metatags).find(Boolean);
  const keywordText = customMeta
    ? `${item.showName} Sinhala Subtitles, ${customMeta}`
    : `${item.showName} Sinhala Subtitles, Sinhala Subitiles TV Series, ${item.showName} Sinhala Subitiles TV Series, PixelPopLK`;
  const canonicalUrl = `${BASE_URL}/content/${item.id}`;

  return {
    meta: [
      { title: titleText },
      { name: "description", content: descText },
      { name: "keywords", content: keywordText },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: titleText },
      { property: "og:description", content: descText },
      { property: "og:type", content: "video.tv_show" },
      { property: "og:url", content: canonicalUrl },
      ...(item.poster ? [{ property: "og:image", content: item.poster }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: titleText },
      { name: "twitter:description", content: descText },
      ...(item.poster ? [{ name: "twitter:image", content: item.poster }] : []),
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  };
}

export const Route = createFileRoute("/content/$id")({
  loader: async ({ params: { id } }) => fetchContentData(id),
  head: buildContentHead,
  component: ContentPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <p className="text-destructive">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Content not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          ← Back home
        </Link>
      </div>
    </div>
  ),
});

function ContentPage() {
  const { id } = Route.useParams();
  // 🟢 Data was already fetched on the server by the loader above, so it's
  // present immediately — no client-side fetch/loading flash, and it's what
  // search engines see in the raw HTML too.
  const data = Route.useLoaderData();
  const isLoading = false;

  const item = useMemo<GridItem | null>(() => {
    if (!data) return null;
    const items = buildGridItems(data);
    const direct = items.find((it) => String(it.id) === id);
    if (direct) return direct;
    for (const it of items) {
      if (it.kind === "series" && it.episodes.some((e) => String(e.id) === id)) return it;
    }
    return null;
  }, [data, id]);

  return (
    <Shell>
      {isLoading ? (
        <div className="h-96 rounded-3xl bg-muted/30 animate-pulse" />
      ) : !data ? (
        <p>Loading…</p>
      ) : !item ? (
        <div className="p-10 text-center text-destructive">Content not found</div>
      ) : (
        <>
          {item.kind === "movie" ? (
            <MovieView key={`movie-${item.id}`} item={item} />
          ) : (
            <SeriesView key={`series-${item.id}`} item={item} />
          )}
          
          <CommentsSection key={`comments-${id}`} subtitleId={id} />
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full">
      <Navbar showBack backTo="/" backText="Back" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full min-w-0">{children}</main>
    </div>
  );
}

function GenreBadges({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 max-w-full">
      {genres.map((g) => (
        <span
          key={g}
          className={`px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide break-all ${genreBadgeClass(g.toLowerCase())}`}
        >
          {g}
        </span>
      ))}
    </div>
  );
}

function Hero({
  poster,
  title,
  year,
  rating,
  genres,
  kindLabel,
  KindIcon,
  description,
  children,
}: {
  poster: string;
  title: string;
  year?: string | null;
  rating?: string | null;
  genres: string[];
  kindLabel: string;
  KindIcon: typeof Film;
  description?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border shadow-card w-full">
      {poster && (
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <img src={poster} alt="" className="w-full h-full object-cover blur-3xl scale-110" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
        </div>
      )}
      <div className="relative grid md:grid-cols-[320px_1fr] gap-0 w-full min-w-0">
        <div className="p-4 sm:p-6 md:p-8 md:pr-0 min-w-0">
          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-border shadow-card bg-muted max-w-[280px] sm:max-w-none mx-auto md:mx-0">
            {poster ? (
              <img src={poster} alt={title} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                <Film className="w-16 h-16" />
              </div>
            )}
          </div>
        </div>
        <div className="p-4 sm:p-8 md:pl-8 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/15 text-primary text-xs font-semibold uppercase tracking-wide">
              <KindIcon className="w-3 h-3" /> {kindLabel}
            </span>
            <GenreBadges genres={genres} />
          </div>
          <h1 className="mt-4 text-2xl sm:text-4xl font-extrabold leading-[1.1] tracking-tight break-words">{title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {year && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">{year}</span>
              </span>
            )}
            {rating && (
              <span className="inline-flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-bold text-foreground">{rating}</span>
                <span className="text-muted-foreground text-xs">/ 10 IMDb</span>
              </span>
            )}
          </div>
          
          {description ? (
            <div className="mt-6 min-w-0">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2">Overview</h3>
              <p className="text-[15px] leading-relaxed text-foreground/85 whitespace-pre-line break-words">{description}</p>
            </div>
          ) : null}

          {/* 🟢 Overview එකට යටින් Ad එක */}
          <AdBanner type="300x250" />

          {children}
        </div>
      </div>
    </div>
  );
}

function MovieView({ item }: { item: Extract<GridItem, { kind: "movie" }> }) {
  const s = item.sub;
  const year = s.year != null && s.year !== "" ? String(s.year) : new Date(s.created_at).getFullYear().toString();
  const genres = splitGenres(s.genre);

  const movieSchema = {
    "@context": "https://schema.org",
    "@type": "Movie",
    "name": s.title,
    "image": s.image_url,
    "description": s.description || `Download Sinhala Subtitle for ${s.title}`,
    "datePublished": s.year || year,
    "workFeaturedBy": {
      "@type": "DataDownload",
      "name": `${s.title} Sinhala Subtitle`,
      "contentUrl": s.download_link,
      "encodingFormat": "application/x-subrip",
      "description": `Download Sinhala Subtitle (.srt) for ${s.title}`
    }
  };

  return (
    <Hero
      poster={s.image_url}
      title={s.title}
      year={year}
      rating={formatRating(s.rating)}
      genres={genres}
      kindLabel="Movie"
      KindIcon={Film}
      description={s.description}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(movieSchema) }}
      />
      
      <div className="mt-7 flex flex-col sm:flex-row gap-3 min-w-0">
        <DownloadButton downloadLink={s.download_link} subtitleId={s.id} label="Direct Download (.srt)" />
        {(s as any).telegram_link && (
          <DownloadButton
            downloadLink={(s as any).telegram_link}
            subtitleId={s.id}
            label="Telegram Download"
            variant="telegram"
          />
        )}
      </div>
      
      <p className="mt-3 text-[11px] text-muted-foreground break-words">
        Opens in a new tab. Thank you for supporting PixelPopLK ❤
      </p>
    </Hero>
  );
}

function SeriesView({ item }: { item: Extract<GridItem, { kind: "series" }> }) {
  const meta = useMemo(() => {
    const s1e1 = item.episodes.find((e) => e.season === 1 && e.episode === 1) || item.episodes[0];
    const withRating = item.episodes.find((e) => e.rating != null && e.rating !== "") ?? item.episodes[0];
    const withYear = item.episodes.find((e) => e.year != null && e.year !== "") ?? item.episodes[0];
    return {
      description: s1e1?.description ?? null,
      rating: formatRating(withRating?.rating),
      year:
        withYear?.year != null && withYear.year !== ""
          ? String(withYear.year)
          : new Date(item.latestDate).getFullYear().toString(),
    };
  }, [item]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    item.episodes.forEach((e) => splitGenres(e.genre).forEach((g) => set.add(g.toUpperCase())));
    return Array.from(set);
  }, [item]);

  const seasons = useMemo(() => {
    const set = new Set(item.episodes.map((e) => e.season));
    return Array.from(set).sort((a, b) => a - b);
  }, [item]);

  const [season, setSeason] = useState<number>(seasons[0] ?? 1);
  const seasonEpisodes = useMemo(
    () => item.episodes.filter((e) => e.season === season).sort((a, b) => a.episode - b.episode),
    [item, season],
  );

  const seriesSchema = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    "name": item.showName,
    "image": item.poster,
    "description": meta.description || `Download Sinhala Subtitles for TV Series ${item.showName}`,
    "numberOfEpisodes": item.episodes.length,
    "numberOfSeasons": seasons.length
  };

  return (
    <Hero
      poster={item.poster}
      title={item.showName}
      year={meta.year}
      rating={meta.rating}
      genres={genres}
      kindLabel="TV Series"
      KindIcon={Tv}
      description={meta.description}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seriesSchema) }}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        {item.episodes.length} episode{item.episodes.length === 1 ? "" : "s"} across {seasons.length} season
        {seasons.length === 1 ? "" : "s"}
      </p>

      <div className="mt-6 min-w-0">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-2 w-full max-w-full">
          {seasons.map((s) => {
            const active = s === season;
            return (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
                  active
                    ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                    : "bg-card/60 text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                }`}
              >
                Season {String(s).padStart(2, "0")}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-2 min-w-0">
          {seasonEpisodes.map((ep) => (
            <Link
              key={String(ep.id)}
              to="/episode/$id"
              params={{ id: String(ep.id) }}
              className="flex items-center gap-2 sm:gap-3 p-3 rounded-xl bg-background/60 border border-border hover:border-primary/40 transition group min-w-0"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
                <PlayCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold truncate group-hover:text-primary transition">
                  Episode {String(ep.episode).padStart(2, "0")}
                  {ep.epTitle ? <span className="text-muted-foreground font-normal"> — {ep.epTitle}</span> : null}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{ep.title}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[11px] sm:text-xs font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] group-hover:shadow-[0_0_20px_rgba(16,185,129,0.55)] group-hover:scale-105 transition-all duration-300 shrink-0">
                Open
              </span>
            </Link>
          ))}
        </div>

        {/* 🟢 අන්තිම Episode එකට යටින් Ad එක */}
        <AdBanner type="160x300" />
      </div>
    </Hero>
  );
}

function CommentsSection({ subtitleId }: { subtitleId: string }) {
  const [authorName, setAuthorName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const { data: comments, refetch } = useQuery({
    queryKey: ["comments", subtitleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subtitle_comments")
        .select("*")
        .eq("subtitle_id", Number(subtitleId) as any)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setIsAdmin(true);
    });

    const savedName = localStorage.getItem("comment_author_name");
    if (savedName) setAuthorName(savedName);
  }, []);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !commentText.trim()) return;

    const lastSubmit = localStorage.getItem("last_comment_submit_time");
    const now = Date.now();
    if (lastSubmit && now - parseInt(lastSubmit, 10) < 15000) {
      alert("Please wait 15 seconds before posting another comment!");
      return;
    }

    setSubmitting(true);
    const { error = null } = await supabase.from("subtitle_comments").insert({
      subtitle_id: Number(subtitleId) as any,
      author_name: authorName.trim(),
      comment_text: commentText.trim(),
    });

    setSubmitting(false);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setCommentText("");
      localStorage.setItem("comment_author_name", authorName.trim());
      localStorage.setItem("last_comment_submit_time", String(now));
      refetch();
    }
  };

  const handleDeleteComment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    const { error } = await supabase.from("subtitle_comments").delete().eq("id", id);
    if (error) alert(error.message);
    else refetch();
  };

  return (
    <div className="bg-card-elevated rounded-3xl border border-border shadow-card p-4 sm:p-8 space-y-6 min-w-0 w-full">
      <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        Feedback & Comments <span className="text-xs font-normal text-muted-foreground">({comments?.length ?? 0})</span>
      </h3>

      <form onSubmit={handleCommentSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-[200px_1fr] gap-3 min-w-0">
          <input
            type="text"
            required
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Your Name *"
            maxLength={30}
            className="w-full px-4 py-2.5 rounded-xl bg-muted/60 border border-border focus:border-primary focus:outline-none text-sm transition-colors"
          />
          <div className="relative min-w-0">
            <input
              type="text"
              required
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Leave a comment... *"
              maxLength={300}
              className="w-full pl-4 pr-12 py-2.5 rounded-xl bg-muted/60 border border-border focus:border-primary focus:outline-none text-sm transition-colors"
            />
            <button
              type="submit"
              disabled={submitting}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center hover:opacity-90 transition cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </form>

      <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide pt-2 min-w-0">
        {comments?.map((comment: any) => {
          const initials = comment.author_name ? comment.author_name.charAt(0).toUpperCase() : "?";
          
          const formattedDate = new Date(comment.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });

          return (
            <div key={comment.id} className="flex gap-3 items-start p-3.5 rounded-2xl bg-muted/30 border border-border/50 group/comment min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold text-xs grid place-items-center shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-foreground/90 truncate">{comment.author_name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formattedDate}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 mt-1 leading-relaxed whitespace-pre-line break-words">{comment.comment_text}</p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="p-1.5 rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition opacity-0 group-hover/comment:opacity-100 cursor-pointer shrink-0"
                  title="Delete Comment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {(!comments || comments.length === 0) && (
          <p className="text-center text-xs text-muted-foreground py-6">
            No comments yet. Be the first to leave a feedback!
          </p>
        )}
      </div>
    </div>
  );
                  }
