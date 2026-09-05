import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Download,
  Film,
  Tv,
  Sparkles,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Subtitles,
  SlidersHorizontal,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { z } from "zod";

import { supabase, SUBTITLES_TABLE, SUBTITLE_COLUMNS, type Subtitle } from "@/integrations/supabase/client";
import {
  buildGridItems,
  itemDate,
  itemGenres,
  itemPoster,
  itemTitle,
  formatDate,
  type GridItem,
} from "@/lib/subtitles";
import { Navbar } from "@/components/Navbar";
import AdBanner from "@/components/AdBanner";

const homeSearchSchema = z.object({
  type: z.enum(["all", "movie", "series"]).optional().catch("all"),
  genre: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
});

async function fetchAllSubtitles(): Promise<Subtitle[]> {
  const { data, error } = await supabase
    .from(SUBTITLES_TABLE)
    .select(SUBTITLE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Subtitle[];
}

export const Route = createFileRoute("/")({
  validateSearch: (search) => homeSearchSchema.parse(search),
  loader: async () => fetchAllSubtitles(),
  head: () => ({
    meta: [
      { title: "PixelPopLK — Sinhala Subtitles for Movies & TV Series" },
      {
        name: "description",
        content:
          "Download the latest premium Sinhala subtitles for movies and TV series. Curated, fast, and secure on PixelPopLK.",
      },
      { name: "keywords", content: "Sinhala Subtitles, Download Movie Subtitles, PixelPopLK, Sinhala Subitiles TV Series, Sinhala Subtitles TV Series, subtitle download, sri lanka subtitles" },
      { property: "og:title", content: "PixelPopLK — Sinhala Subtitles for Movies & TV Series" },
      { property: "og:description", content: "Download the latest premium Sinhala subtitles for movies and TV series. Curated, fast, and secure on PixelPopLK." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "PixelPopLK — Sinhala Subtitles for Movies & TV Series" },
      { name: "twitter:description", content: "Download the latest premium Sinhala subtitles for movies and TV series. Curated, fast, and secure on PixelPopLK." },
    ],
    links: [{ rel: "canonical", href: "https://pixelpoplk.pages.dev/" }],
  }),
  component: HomePage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mt-2">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Not found</div>,
});

type Category = "All" | "Movies" | "TV Series" | "Action" | "Sci-Fi" | "Horror" | "Thriller";
const CATEGORIES: Category[] = ["All", "Movies", "TV Series", "Action", "Sci-Fi", "Horror", "Thriller"];

function matchesFilter(it: GridItem, type: "all" | "movie" | "series", genre?: string) {
  if (type === "movie" && it.kind !== "movie") return false;
  if (type === "series" && it.kind !== "series") return false;

  if (genre) {
    const genres = itemGenres(it);
    const target = genre.toLowerCase();
    
    return genres.some((g) => {
      const lowerG = String(g).toLowerCase(); 

      return (
        lowerG === target ||
        lowerG.includes(target) ||
        (target === "sci-fi" && (lowerG === "scifi" || lowerG === "sci fi" || lowerG === "science fiction"))
      );
    });
  }
  return true;
}

function matchesQuery(it: GridItem, q: string) {
  if (!q) return true;
  if (itemTitle(it).toLowerCase().includes(q)) return true;
  if (it.kind === "series") {
    return it.episodes.some(
      (e) => e.title?.toLowerCase().includes(q) || e.epTitle?.toLowerCase().includes(q),
    );
  }
  return false;
}

type YearFilter = "All" | "2026" | "2025" | "2024" | "2023" | "Older";
type RatingFilter = "All" | "8.0+" | "7.0+" | "6.0+";
type SortFilter = "latest" | "alpha";

function getItemYear(it: GridItem): number | null {
  if (it.kind === "movie") {
    const y = it.sub?.year;
    if (y !== undefined && y !== null && String(y).trim() !== "") return parseInt(String(y), 10);
    return it.sub?.created_at ? new Date(it.sub.created_at).getFullYear() : null;
  }
  const ep = it.episodes?.[0];
  if (ep?.year !== undefined && ep?.year !== null && String(ep.year).trim() !== "") return parseInt(String(ep.year), 10);
  return it.latestDate ? new Date(it.latestDate).getFullYear() : null;
}

function getItemRating(it: GridItem): number | null {
  const raw = it.kind === "movie" ? it.sub?.rating : it.episodes?.[0]?.rating;
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return isNaN(n) ? null : n;
}

function matchesYear(it: GridItem, yf: YearFilter): boolean {
  if (yf === "All") return true;
  const y = getItemYear(it);
  if (y == null) return false;
  if (yf === "Older") return y <= 2022;
  return y === parseInt(yf, 10);
}

function matchesRating(it: GridItem, rf: RatingFilter): boolean {
  if (rf === "All") return true;
  const r = getItemRating(it);
  if (r == null) return false;
  const min = parseFloat(rf);
  return r >= min;
}

function sanitizeInput(str: string): string {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, "");
}

function HomePage() {
  const navigate = useNavigate();
  const { type = "all", genre, q } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [slide, setSlide] = useState(0);
  const [yearFilter, setYearFilter] = useState<YearFilter>("All");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("All");
  const [sortFilter, setSortFilter] = useState<SortFilter>("latest");

  // Monetag Timer States
  const [modalOpen, setModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [targetId, setTargetId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  // Request Subtitle Form States
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestType, setRequestType] = useState<"movie" | "tv">("movie");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestStatusMsg, setRequestStatusMsg] = useState("");

  useEffect(() => {
    if (q !== undefined) {
      setQuery(sanitizeInput(q));
    } else {
      setQuery("");
    }
  }, [q]);

  const handleQueryChange = (val: string) => {
    const cleanVal = sanitizeInput(val);
    setQuery(cleanVal);
    navigate({
      search: (prev) => ({ ...prev, q: cleanVal || undefined }),
      replace: true,
    });
  };

  const data = Route.useLoaderData();
  const isLoading = false;
  const error: Error | null = null;

  const items = useMemo(() => buildGridItems(data ?? []), [data]);
  const featured = useMemo(() => items.slice(0, 6), [items]);

  useEffect(() => {
    if (featured.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % featured.length), 5500);
    return () => clearInterval(t);
  }, [featured.length]);

  const filtered = useMemo(() => {
    const qClean = query.trim().toLowerCase();
    let result = items.filter(
      (it) =>
        matchesQuery(it, qClean) &&
        matchesFilter(it, type, genre) &&
        matchesYear(it, yearFilter) &&
        matchesRating(it, ratingFilter),
    );
    if (sortFilter === "alpha") {
      result = [...result].sort((a, b) => itemTitle(a).localeCompare(itemTitle(b)));
    }
    return result;
  }, [items, query, type, genre, yearFilter, ratingFilter, sortFilter]);

  const rowResetKey = `${type}|${genre ?? ""}|${query}|${yearFilter}|${ratingFilter}|${sortFilter}`;

  const activeCategory = useMemo<Category>(() => {
    if (type === "all" && !genre) return "All";
    if (type === "movie" && !genre) return "Movies";
    if (type === "series" && !genre) return "TV Series";
    if (genre === "Action") return "Action";
    if (genre === "Sci-Fi") return "Sci-Fi";
    if (genre === "Horror") return "Horror";
    if (genre === "Thriller") return "Thriller";
    return "All";
  }, [type, genre]);

  const handleCategoryChange = (cat: Category) => {
    if (cat === "All") {
      navigate({ search: (prev) => ({ ...prev, type: "all", genre: undefined }) });
    } else if (cat === "Movies") {
      navigate({ search: (prev) => ({ ...prev, type: "movie", genre: undefined }) });
    } else if (cat === "TV Series") {
      navigate({ search: (prev) => ({ ...prev, type: "series", genre: undefined }) });
    } else {
      navigate({ search: (prev) => ({ ...prev, type: "all", genre: cat }) });
    }
  };

  const handleDownloadClick = (id: string) => {
    completedRef.current = false;
    setTargetId(id);
    setCountdown(5);
    setModalOpen(true);
    
    const adUrl = Math.random() < 0.5 
      ? "https://omg10.com/4/11202064" 
      : "https://www.effectivecpmnetwork.com/b795sywmp?key=20b07ce2b76b7238eae7acf49dd3a534";
    
    window.open(adUrl, "_blank");
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTitle.trim()) return;

    const lastSubmit = localStorage.getItem("last_request_submit_time");
    const now = Date.now();
    if (lastSubmit && now - parseInt(lastSubmit, 10) < 15000) {
      setRequestStatusMsg("Error: Please wait 15 seconds before submitting another request.");
      return;
    }

    setRequestLoading(true);
    setRequestStatusMsg("");

    const { error } = await supabase.from("subtitle_requests").insert({
      title: requestTitle.trim(),
      type: requestType,
      notes: requestNotes.trim() || null,
    });

    setRequestLoading(false);
    if (error) {
      setRequestStatusMsg(`Error: ${error.message}`);
    } else {
      setRequestStatusMsg("Request submitted successfully! Thank you ❤");
      setRequestTitle("");
      setRequestNotes("");
      localStorage.setItem("last_request_submit_time", String(now));
      setTimeout(() => setRequestModalOpen(false), 2500);
    }
  };

  useEffect(() => {
    if (!modalOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          completedRef.current = true;
          setModalOpen(false);
          if (targetId) {
            navigate({ to: "/content/$id", params: { id: targetId } });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [modalOpen, targetId, navigate]);

  const collectionSchema = useMemo(() => {
    if (!filtered || filtered.length === 0) return null;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://pixelpoplk.pages.dev";
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Latest Sinhala Subtitles",
      "numberOfItems": filtered.length,
      "itemListElement": filtered.slice(0, 20).map((it, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "url": `${baseUrl}/content/${it.id}`,
        "name": itemTitle(it)
      }))
    };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      {collectionSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
        />
      )}
      
      {/* 🟢 Navbar එක data-no-ad යොදා Search input එක ආරක්ෂා කර ඇත */}
      <div data-no-ad="true">
        <Navbar
          showSearch
          query={query}
          setQuery={handleQueryChange}
          searchResults={items.map((it) => ({
            id: it.id,
            title: itemTitle(it),
            type: it.kind === "movie" ? "Movie" : "TV Series",
            posterUrl: itemPoster(it),
            year: getItemYear(it) ? String(getItemYear(it)) : undefined,
          }))}
        />
      </div>

      <Hero 
        featured={featured} 
        slide={slide} 
        setSlide={setSlide} 
        loading={isLoading} 
        onDownload={handleDownloadClick} 
      />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-4 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Browse <span className="text-gradient">Subtitles</span>
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {isLoading ? "Loading…" : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}
              {query && ` for "${query}"`}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2" data-no-ad="true">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
            </div>
            <FilterSelect
              id="filter-year"
              value={yearFilter}
              onChange={(v) => setYearFilter(v as YearFilter)}
              options={[
                { value: "All", label: "Year" },
                { value: "2026", label: "2026" },
                { value: "2025", label: "2025" },
                { value: "2024", label: "2024" },
                { value: "2023", label: "2023" },
                { value: "Older", label: "Older" },
              ]}
              active={yearFilter !== "All"}
            />
            <FilterSelect
              id="filter-rating"
              value={ratingFilter}
              onChange={(v) => setRatingFilter(v as RatingFilter)}
              options={[
                { value: "All", label: "IMDb Rating" },
                { value: "8.0+", label: "8.0+ ⭐" },
                { value: "7.0+", label: "7.0+ ⭐" },
                { value: "6.0+", label: "6.0+ ⭐" },
              ]}
              active={ratingFilter !== "All"}
            />
            <FilterSelect
              id="filter-sort"
              value={sortFilter}
              onChange={(v) => setSortFilter(v as SortFilter)}
              options={[
                { value: "latest", label: "Sort: Latest" },
                { value: "alpha", label: "Sort: A–Z" },
              ]}
              active={sortFilter !== "latest"}
            />
            {(yearFilter !== "All" || ratingFilter !== "All" || sortFilter !== "latest") && (
              <button
                onClick={() => {
                  setYearFilter("All");
                  setRatingFilter("All");
                  setSortFilter("latest");
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border text-xs text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
        </div>

        <FilterTabs active={activeCategory} onChange={handleCategoryChange} />

        {/* 🟢 High CTR Banner 300x250 */}
        <div className="my-6">
          <AdBanner type="300x250" />
        </div>

        {error && (
          <div className="mt-8 p-6 rounded-xl border border-destructive/30 bg-destructive/10 text-sm">
            Failed to load subtitles: {(error as Error).message}
          </div>
        )}

        {isLoading ? (
          <SkeletonRow />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : query ? (
          <Row 
            title="Search Results" 
            icon={<Search className="w-4 h-4" />} 
            items={filtered} 
            resetKey={rowResetKey}
          />
        ) : (
          <div className="mt-8 space-y-12">
            {type !== "series" && (
              <Row
                title={genre ? `${genre} Movies` : "Movies"}
                icon={<Film className="w-4 h-4" />}
                items={filtered.filter((it) => it.kind === "movie")}
                resetKey={rowResetKey}
              />
            )}
            {type !== "movie" && (
              <Row
                title={genre ? `${genre} TV Series` : "TV Series"}
                icon={<Tv className="w-4 h-4" />}
                items={filtered.filter((it) => it.kind === "series")}
                resetKey={rowResetKey}
              />
            )}
          </div>
        )}
      </section>

      {/* Request Subtitle Banner Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="bg-gradient-to-r from-primary/10 to-cyan-500/10 rounded-3xl border border-border/80 p-8 text-center max-w-4xl mx-auto shadow-card">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Can't find your <span className="text-gradient">Subtitle</span>?
          </h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto">
            Submit a request and we will translate and upload it as soon as possible!
          </p>
          <button
            onClick={() => setRequestModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-primary text-primary-foreground font-semibold text-sm shadow-glow hover:opacity-95 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> Request a Subtitle
          </button>
        </div>
      </section>

      <Footer />

      {/* 🟢 Request Subtitle Modal (data-no-ad යොදා ad popups වළක්වා ඇත) */}
      <AnimatePresence>
        {requestModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-no-ad="true"
            className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-default"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => {
                  setRequestModalOpen(false);
                  setRequestTitle("");
                  setRequestNotes("");
                  setRequestStatusMsg("");
                }}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl font-bold tracking-tight">Request a Subtitle</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Tell us what subtitle you need, and we'll work on it.
              </p>

              <form onSubmit={handleRequestSubmit} className="mt-5 space-y-4 text-left">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Movie / Series Title *</span>
                  <input
                    type="text"
                    required
                    value={requestTitle}
                    onChange={(e) => setRequestTitle(e.target.value)}
                    placeholder="e.g. Inception (2010)"
                    className="mt-2 w-full px-4 py-2.5 rounded-xl bg-muted/60 border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Type</span>
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value as "movie" | "tv")}
                    className="mt-2 w-full px-4 py-2.5 rounded-xl bg-muted/60 border border-border focus:border-primary focus:outline-none text-sm cursor-pointer"
                  >
                    <option value="movie" className="bg-background text-foreground">Movie</option>
                    <option value="tv" className="bg-background text-foreground">TV Series</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Additional Notes (Optional)</span>
                  <textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="e.g. IMDb Link, specific season/episode, or sync details..."
                    rows={3}
                    className="mt-2 w-full px-4 py-2.5 rounded-xl bg-muted/60 border border-border focus:border-primary focus:outline-none text-sm resize-none"
                  />
                </label>

                {requestStatusMsg && (
                  <p className={`text-xs flex items-center gap-1.5 ${requestStatusMsg.includes("Error") ? "text-destructive" : "text-primary"}`}>
                    {requestStatusMsg.includes("Error") ? <AlertCircle className="w-4.5 h-4.5" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
                    {requestStatusMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={requestLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-primary text-primary-foreground font-bold text-sm shadow-glow hover:opacity-95 transition cursor-pointer disabled:opacity-60"
                >
                  {requestLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  ) : (
                    "Submit Request"
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🟢 Clean Countdown Modal (Alerts සහ freeze ඉවත් කර ඇත) */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-no-ad="true"
            className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-default"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border p-6 sm:p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/15 grid place-items-center mb-4 animate-bounce">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              </div>

              <h3 className="text-xl font-bold tracking-tight">Loading Content...</h3>
              <p className="text-muted-foreground text-sm mt-2">
                Please wait a moment while we prepare your page.
              </p>

              <div className="my-6 flex items-center justify-center relative h-20">
                <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin absolute" />
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold text-primary bg-muted/40">
                  {countdown}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground/70 bg-muted/30 py-2.5 px-3 rounded-xl border border-border leading-relaxed">
                Loading your destination, please do not close this window.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Hero({
  featured,
  slide,
  setSlide,
  loading,
  onDownload,
}: {
  featured: GridItem[];
  slide: number;
  setSlide: (i: number | ((s: number) => number)) => void;
  loading: boolean;
  onDownload: (id: string) => void;
}) {
  if (loading) {
    return (
      <section className="bg-hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="h-72 rounded-3xl bg-muted/40 animate-pulse" />
        </div>
      </section>
    );
  }

  if (featured.length === 0) {
    return (
      <section className="bg-hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Sinhala Subtitles
          </span>
          <h1 className="mt-5 text-4xl sm:text-6xl font-extrabold tracking-tight">
            <span className="text-gradient">PixelPopLK</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Premium curated Sinhala subtitles for the films and series you love.
          </p>
        </div>
      </section>
    );
  }

  const current = featured[slide];
  const tv = current.kind === "series";
  const next = () => setSlide((s) => (s + 1) % featured.length);
  const prev = () => setSlide((s) => (s - 1 + featured.length) % featured.length);

  return (
    <section className="bg-hero">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12">
        <div className="flex items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Trending Now
          </span>
          <span className="text-xs text-muted-foreground">Sinhala Subtitles</span>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border shadow-card">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.key}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="relative h-[360px] sm:h-[440px]"
            >
              <img
                src={itemPoster(current)}
                alt={itemTitle(current)}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0")}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />

              <div className="relative h-full flex items-end sm:items-center">
                <div className="p-6 sm:p-10 max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/20 text-primary text-xs font-semibold">
                    {tv ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                    {tv ? "TV Series" : "Movie"}
                  </span>
                  <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                    {itemTitle(current)}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {tv
                      ? `${current.episodes.length} episode${current.episodes.length === 1 ? "" : "s"} · Updated `
                      : "Released "}
                    {formatDate(itemDate(current))}
                  </p>
                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => onDownload(String(current.id))}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-primary text-primary-foreground font-semibold text-sm shadow-glow hover:opacity-95 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> {tv ? "View Episodes" : "Get Subtitle"}
                    </button>
                    {/* 🟢 Real Link for Google Crawling & Speed */}
                    <Link
                      to="/content/$id"
                      params={{ id: String(current.id) }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border bg-card/60 backdrop-blur text-sm font-medium hover:bg-card transition cursor-pointer"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {featured.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/60 backdrop-blur border border-border hover:bg-background grid place-items-center transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/60 backdrop-blur border border-border hover:bg-background grid place-items-center transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {featured.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSlide(i)}
                    aria-label={`Slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === slide ? "w-8 bg-primary" : "w-2 bg-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  id,
  value,
  onChange,
  options,
  active,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  active: boolean;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none cursor-pointer pl-3 pr-7 py-1.5 rounded-lg text-xs font-semibold border transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          active
            ? "bg-primary/15 border-primary/40 text-primary"
            : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
        }`}
        style={{ backgroundImage: "none" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-background text-foreground">
            {o.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function FilterTabs({ active, onChange }: { active: Category; onChange: (c: Category) => void }) {
  return (
    <div id="browse" className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1" data-no-ad="true">
      {CATEGORIES.map((c) => {
        const isActive = active === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition ${
              isActive
                ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                : "bg-card/60 text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

const ROW_PAGE_SIZE = 24;

function Row({ 
  title, 
  icon, 
  items, 
  resetKey,
}: { 
  title: string; 
  icon?: React.ReactNode; 
  items: GridItem[]; 
  resetKey: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(ROW_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(ROW_PAGE_SIZE);
  }, [resetKey]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.85) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return (
    <div className="group/row relative">
      <div className="flex items-end justify-between mb-3 px-0.5">
        <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight">
          <span className="text-primary">{icon}</span>
          {title}
          <span className="text-xs font-medium text-muted-foreground ml-1">{items.length}</span>
        </h3>
        <div className="hidden sm:flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollBy(-1)}
            className="w-9 h-9 rounded-full bg-card/70 backdrop-blur border border-border hover:border-primary/50 hover:text-primary grid place-items-center transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollBy(1)}
            className="w-9 h-9 rounded-full bg-card/70 backdrop-blur border border-border hover:border-primary/50 hover:text-primary grid place-items-center transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-12 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-12 bg-gradient-to-l from-background to-transparent z-10" />

        {/* 🟢 Grid Cards Container */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3.5 sm:gap-4 px-4 sm:px-6 lg:px-8 py-1">
          {visibleItems.map((it, i) => (
            <div key={it.key}>
              <SubtitleCard item={it} index={i} />
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="flex justify-center px-4 sm:px-6 lg:px-8 mt-5">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + ROW_PAGE_SIZE)}
              className="px-6 py-2.5 rounded-full border border-border bg-card/60 backdrop-blur text-sm font-semibold hover:bg-card hover:border-primary/40 transition cursor-pointer"
            >
              Load More ({items.length - visibleCount} left)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="mt-8 space-y-10">
      {Array.from({ length: 2 }).map((_, r) => (
        <div key={r}>
          <div className="h-5 w-32 bg-muted/40 rounded animate-pulse mb-3" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[44vw] sm:w-[28vw] md:w-[22vw] lg:w-[18vw] xl:w-[15vw] max-w-[220px] rounded-2xl overflow-hidden border border-border bg-card/40"
              >
                <div className="aspect-[2/3] bg-muted/40 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 rounded bg-muted/40 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted/40 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// 🟢 ප්‍රධානම වෙනස: <button> වෙනුවට සැබෑ <Link> (<a> tag) භාවිතා කිරීම
// මේ නිසා Google Search Engine එකට site එකේ තියෙන සියලුම Subtitles auto index කරගැනීමට හැකියාව ලැබේ!
function SubtitleCard({ 
  item, 
  index, 
}: { 
  item: GridItem; 
  index: number; 
}) {
  const tv = item.kind === "series";
  const title = itemTitle(item);
  const poster = itemPoster(item);
  const seasonCount = tv ? new Set(item.episodes.map((e) => e.season)).size : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.02, 0.3) }}
    >
      <Link
        to="/content/$id"
        params={{ id: String(item.id) }}
        className="group block text-left bg-card-elevated rounded-2xl overflow-hidden border border-border hover:border-primary/40 transition shadow-card hover:shadow-glow w-full cursor-pointer"
      >
        <div className="relative aspect-[2/3] bg-muted overflow-hidden">
          {poster ? (
            <img
              src={poster}
              alt={title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-muted-foreground">
              <Film className="w-10 h-10" />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background/80 backdrop-blur text-[10px] font-semibold uppercase tracking-wide">
              {tv ? <Tv className="w-3 h-3 text-accent-cyan" /> : <Film className="w-3 h-3 text-primary" />}
              {tv ? "Series" : "Movie"}
            </span>
          </div>
          {tv && (
            <div className="absolute top-2 right-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase tracking-wide">
                {seasonCount} S · {item.episodes.length} EP
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-background/95 to-transparent opacity-0 group-hover:opacity-100 transition">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Download className="w-3.5 h-3.5" /> View details
            </div>
          </div>
        </div>
        <div className="p-3">
          <h3 className="text-sm font-semibold line-clamp-2 leading-snug group-hover:text-primary transition">
            {title}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(itemDate(item))}</p>
        </div>
      </Link>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-muted grid place-items-center">
        <Search className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No subtitles found</h3>
      <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or category filters.</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary grid place-items-center">
            <Subtitles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold">
            Pixel<span className="text-gradient">Pop</span>LK
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} PixelPopLK · Sinhala Subtitles for Movies & TV Series
        </p>
      </div>
    </footer>
  );
}
