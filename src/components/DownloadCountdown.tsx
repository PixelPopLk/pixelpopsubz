import React, { useEffect, useRef, useState, useCallback } from "react";
import { Download, Lock, AlertTriangle, CheckCircle2, Loader2, Send, ExternalLink } from "lucide-react";
import { supabase, logDownload } from "@/integrations/supabase/client";

const MONETAG_URL = "https://acorntar.com/fncjyve9?key=a347a729277e7dcc5e07924adff80652";
const ADSTERRA_URL = "https://acorntar.com/b795sywmp?key=20b07ce2b76b7238eae7acf49dd3a534";

const REQUIRED_AD_SECONDS = 5;
const SILENT_RELOCK_MS = 10000; // Download කර තත්පර 10න් ආපසු Lock වේ

const getRandomAdUrl = () => (Math.random() < 0.5 ? MONETAG_URL : ADSTERRA_URL);

// 🟢 Trusted Domains Whitelist
const ALLOWED_HOSTS = ["supabase.co", "t.me", "telegram.me", "telegram.dog"];

const isAllowedHost = (hostname: string) => {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
};

export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url || typeof window === "undefined") return false;
  try {
    const cleanUrl = url.trim();
    if (cleanUrl.startsWith("/")) return true;
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return parsed.origin === window.location.origin || isAllowedHost(parsed.hostname);
  } catch {
    return false;
  }
}

// 🚀 Fast Native Download Function
function triggerFastNativeDownload(rawUrl: string, title?: string) {
  try {
    const fullUrl = rawUrl.trim();
    const urlObj = new URL(fullUrl);
    const extMatch = urlObj.pathname.match(/\.(zip|rar|7z|srt|sub|ass)$/i);
    const extension = extMatch ? extMatch[1].toLowerCase() : "zip";

    const rawTitle = title || "Subtitle";
    const invalidChars = ["\\", "/", ":", "*", "?", '"', "<", ">", "|"];
    const safeTitle =
      rawTitle
        .split("")
        .filter((char) => !invalidChars.includes(char))
        .join("")
        .trim() || "Subtitle";

    const fileName = `${safeTitle} Sinhala Sub - PixelPopLK.${extension}`;

    if (urlObj.hostname.endsWith(".supabase.co") || urlObj.hostname === "supabase.co") {
      urlObj.searchParams.set("download", fileName);
    }

    const downloadUrlWithDisposition = urlObj.toString();
    const a = document.createElement("a");
    a.href = downloadUrlWithDisposition;
    a.setAttribute("download", fileName);
    a.setAttribute("target", "_self");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    window.location.href = rawUrl.trim();
  }
}

interface DownloadButtonProps {
  subtitleId?: string | number;
  title?: string;
  label?: string;
  className?: string;
  variant?: "primary" | "direct" | "telegram";
}

type ButtonState = "locked" | "verifying" | "paused" | "fetching" | "ready" | "downloading";

export function DownloadButton({
  subtitleId,
  title,
  label = "Direct Download (.zip)",
  className,
  variant = "primary",
}: DownloadButtonProps) {
  const normalizedVariant = variant === "telegram" ? "telegram" : "direct";
  const subId = subtitleId || "default";

  // 🟢 Direct සහ Telegram දෙකට වෙන වෙනම Storage keys (දෙක එකිනෙක unlock නොවේ)
  const sessionKey = `pxl_ad_time_${subId}_${normalizedVariant}`;

  const [state, setState] = useState<ButtonState>("locked");
  const [accumulatedMs, setAccumulatedMs] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<number>(REQUIRED_AD_SECONDS);
  const [resolvedLink, setResolvedLink] = useState<string>("");

  const leftAtRef = useRef<number | null>(null);
  const reLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Link එක Fetch කිරීම
  const fetchLink = useCallback(async (): Promise<string | null> => {
    if (!subtitleId) return null;
    try {
      const { data, error } = await supabase.rpc("get_single_download_link", {
        target_id: Number(subtitleId),
      });
      if (!error && data) {
        return normalizedVariant === "telegram" ? data.telegram_link : data.download_link;
      }
    } catch {
      /* noop */
    }
    return null;
  }, [subtitleId, normalizedVariant]);

  // Lock තත්ත්වයට Reset කිරීම
  const resetToLocked = useCallback(() => {
    setState("locked");
    setAccumulatedMs(0);
    setRemainingSec(REQUIRED_AD_SECONDS);
    setResolvedLink("");
    leftAtRef.current = null;
    try {
      sessionStorage.removeItem(sessionKey);
    } catch {
      /* noop */
    }
  }, [sessionKey]);

  // Download වූ පසු තත්පර 10කින් Auto Lock කිරීම
  const scheduleSilentRelock = useCallback(() => {
    if (reLockTimerRef.current) clearTimeout(reLockTimerRef.current);
    reLockTimerRef.current = setTimeout(() => {
      resetToLocked();
    }, SILENT_RELOCK_MS);
  }, [resetToLocked]);

  // 🟢 User නැවත Tab එකට පැමිණි විට තත්පර 5 සම්පූර්ණදැයි පරීක්ෂා කිරීම (Pause / Resume Logic)
  const handleUserReturned = useCallback(async () => {
    if (state !== "verifying" || leftAtRef.current === null) return;

    const now = Date.now();
    const timeSpentAway = now - leftAtRef.current;
    leftAtRef.current = null;

    const totalTimeMs = accumulatedMs + timeSpentAway;
    setAccumulatedMs(totalTimeMs);

    try {
      sessionStorage.setItem(sessionKey, String(totalTimeMs));
    } catch {
      /* noop */
    }

    // තත්පර 5 සම්පූර්ණ වී ඇත්නම් ➔ READY (Unlock)
    if (totalTimeMs >= REQUIRED_AD_SECONDS * 1000) {
      setState("fetching");
      const link = await fetchLink();
      if (link && isSafeUrl(link)) {
        setResolvedLink(link);
        setState("ready");
      } else {
        alert("Download link එක ලබාගැනීමේ දෝෂයක් ඇත. කරුණාකර නැවත උත්සාහ කරන්න.");
        resetToLocked();
      }
    } else {
      // 🛑 තත්පර 5ට කලින් පැමිණියේ නම් ➔ PAUSE කර ඉතිරි තත්පර ගණන පෙන්වීම
      const remainingMs = REQUIRED_AD_SECONDS * 1000 - totalTimeMs;
      const remSec = Math.max(1, Math.ceil(remainingMs / 1000));
      setRemainingSec(remSec);
      setState("paused");
    }
  }, [state, accumulatedMs, sessionKey, fetchLink, resetToLocked]);

  // Visibility Change / Focus Listener
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleUserReturned();
      }
    };

    const onWindowFocus = () => {
      handleUserReturned();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      if (reLockTimerRef.current) clearTimeout(reLockTimerRef.current);
    };
  }, [handleUserReturned]);

  // Button Click Handler
  const handleButtonClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // 1. LOCKED හෝ PAUSED අවස්ථාවේදී: Ad එක Open කර Timer එක ආරම්භ කිරීම
    if (state === "locked" || state === "paused") {
      const activeAdUrl = getRandomAdUrl();
      leftAtRef.current = Date.now();

      try {
        const w = window.open(activeAdUrl, "_blank", "noopener");
        if (w) w.opener = null;
      } catch {
        /* noop */
      }

      setState("verifying");
      return;
    }

    // 2. VERIFYING අවස්ථාවේදී Click කළහොත් (Ad එක නැවත විවෘත කිරීම)
    if (state === "verifying") {
      const activeAdUrl = getRandomAdUrl();
      leftAtRef.current = Date.now();
      try {
        window.open(activeAdUrl, "_blank", "noopener");
      } catch {
        /* noop */
      }
      return;
    }

    // 3. READY (Unlocked) අවස්ථාවේදී: ක්ෂණික Fast Download කිරීම
    if (state === "ready") {
      if (!resolvedLink || !isSafeUrl(resolvedLink)) {
        alert("Download link එක අවලංගුයි. කරුණාකර නැවත උත්සාහ කරන්න.");
        resetToLocked();
        return;
      }

      setState("downloading");

      if (normalizedVariant === "telegram") {
        window.open(resolvedLink.trim(), "_blank", "noopener");
      } else {
        triggerFastNativeDownload(resolvedLink, title);
      }

      logDownload(subtitleId, normalizedVariant);

      // Download වූ සැණින් නිහඬව තත්පර 10ක Re-lock timer එක ක්‍රියාත්මක කිරීම
      scheduleSilentRelock();

      setTimeout(() => {
        setState("ready");
      }, 1500);
    }
  };

  // Button Styles State අනුව වෙනස් වීම
  const getButtonContent = () => {
    switch (state) {
      case "locked":
        return (
          <>
            <Lock className="w-4 h-4" />
            <span>{normalizedVariant === "telegram" ? "🔓 Unlock Telegram Subtitle" : `🔓 Unlock ${label}`}</span>
          </>
        );

      case "verifying":
        return (
          <>
            <ExternalLink className="w-4 h-4 animate-bounce" />
            <span>Ad Opened... Return after 5s</span>
          </>
        );

      case "paused":
        return (
          <>
            <AlertTriangle className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{`⚠️ Paused! (${remainingSec}s left) - Click to Resume`}</span>
          </>
        );

      case "fetching":
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Preparing link...</span>
          </>
        );

      case "ready":
        return (
          <>
            {normalizedVariant === "telegram" ? <Send className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            <span className="font-extrabold">
              {normalizedVariant === "telegram" ? "Open Telegram Subtitle" : "Download Now (.zip)"}
            </span>
          </>
        );

      case "downloading":
        return (
          <>
            <CheckCircle2 className="w-4 h-4 text-white animate-pulse" />
            <span>Downloading File...</span>
          </>
        );
    }
  };

  const getButtonClass = () => {
    const base = "inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm transition-all duration-300 cursor-pointer shadow-lg active:scale-95";

    switch (state) {
      case "locked":
        return normalizedVariant === "telegram"
          ? `${base} bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_4px_15px_rgba(14,165,233,0.35)] hover:opacity-95`
          : `${base} bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95`;

      case "verifying":
        return `${base} bg-indigo-600 text-white animate-pulse border border-indigo-400/30`;

      case "paused":
        return `${base} bg-gradient-to-r from-amber-600 to-orange-600 text-white border border-amber-400/40 shadow-[0_4px_15px_rgba(245,158,11,0.35)]`;

      case "fetching":
        return `${base} bg-muted text-foreground cursor-wait`;

      case "ready":
      case "downloading":
        return `${base} bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.45)] animate-shimmer`;
    }
  };

  return (
    <button
      type="button"
      data-no-ad="true"
      data-download="true"
      disabled={state === "fetching" || state === "downloading"}
      onClick={handleButtonClick}
      className={className ? `${className} ${getButtonClass()}` : getButtonClass()}
    >
      {getButtonContent()}
    </button>
  );
}
