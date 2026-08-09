import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gilnzvsnkwrnfbwhobow.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ZWL-aXdaOXfnYKKaTJO58w_FIya45KL";

export type Subtitle = {
  id: number | string;
  created_at: string;
  title: string;
  download_link: string;
  image_url: string;
  genre?: string | null;
  description?: string | null;
  rating?: number | string | null;
  year?: number | string | null;
  season?: number | string | null;
  episode?: number | string | null;
  download_count?: number | null;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const SUBTITLES_TABLE = "subtitles";
export const SUBTITLE_COLUMNS =
  "id, created_at, title, download_link, image_url, genre, description, rating, year, season, episode, download_count";

// 🟢 Download analytics — logs one event + bumps the lifetime counter via a
// single RPC (see supabase/sql/download_analytics_setup.sql). Fire-and-forget:
// analytics must never block or break an actual download for the user.
export function logDownload(subtitleId: number | string | null | undefined, variant: string = "direct") {
  if (subtitleId == null) return;
  const idNum = typeof subtitleId === "number" ? subtitleId : Number(subtitleId);
  if (Number.isNaN(idNum)) return;

  supabase.rpc("log_subtitle_download", { p_subtitle_id: idNum, p_variant: variant }).then(({ error }) => {
    if (error) console.warn("logDownload failed:", error.message);
  });
}
