import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Lock, AlertTriangle, CheckCircle, X, ExternalLink } from "lucide-react";
import { supabase, logDownload } from "@/integrations/supabase/client";

const MONETAG_URL = "https://acorntar.com/fncjyve9?key=a347a729277e7dcc5e07924adff80652";
const ADSTERRA_URL = "https://acorntar.com/b795sywmp?key=20b07ce2b76b7238eae7acf49dd3a534";

const COUNTDOWN_SECONDS = 5;
const SILENT_RELOCK_MS = 10000; // කිසිදු දැනුම්දීමකින් තොරව තත්පර 10න් Lock වේ

// 🟢 FIX: short visible grace period before we auto-send the user back to
// the ad if they returned early. This is a same-tab navigation (not a
// popup), so it's safe to fire from a setTimeout without a fresh click.
const AUTO_REDIRECT_GRACE_MS = 1800;

const getRandomAdUrl = () => (Math.random() < 0.5 ? MONETAG_URL : ADSTERRA_URL);

export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const cleanUrl = url.trim();
    if (cleanUrl.startsWith("/")) return true;
    const parsed = new URL(cleanUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "ipfs:";
  } catch {
    return false;
  }
}

// --- localStorage helpers -------------------------------------------------
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}
function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}
function getValidTimestamp(key: string): number | null {
  const raw = safeGet(key);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    safeRemove(key);
    return null;
  }
  return parsed;
}

// 🚀 Native download — keeps the full URL (incl. query string) intact so
// Supabase Storage's Content-Disposition: attachment actually fires.
function triggerFastNativeDownload(rawUrl: string) {
  const url = rawUrl.trim();
  try {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      window.location.href = url;
    }
  } catch {
    window.location.href = url;
  }
}

interface DownloadCountdownModalProps {
  downloadLink?: string;
  subtitleId?: string | number;
  title?: string;
  variant?: string;
  onClose: () => void;
  onUnlockSuccess: (link: string) => void;
  onDownloadTriggered: () => void;
}

export function DownloadCountdownModal({
  downloadLink,
  subtitleId,
  variant = "direct",
  onClose,
  onUnlockSuccess,
  onDownloadTriggered,
}: DownloadCountdownModalProps) {
  const [status, setStatus] = useState<"idle" | "verifying" | "warning" | "completed">("idle");
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [redirectIn, setRedirectIn] = useState(0);
  const [resolvedLink, setResolvedLink] = useState<string>(downloadLink || "");

  const tickTimerRef = useRef<any>(null);
  const redirectTimerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const normalizedVariant = variant === "telegram" ? "telegram" : "direct";
  const storagePrefix = `sub_ad_${subtitleId || "default"}_${normalizedVariant}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleComplete = async () => {
    let finalLink = downloadLink || "";

    if (!finalLink && subtitleId) {
      try {
        const { data, error } = await supabase.rpc("get_single_download_link", {
          target_id: Number(subtitleId),
        });

        if (!error && data) {
          finalLink = normalizedVariant === "telegram" ? data.telegram_link : data.download_link;
        }
      } catch (err) {
        console.error("Error fetching link:", err);
      }
    }

    if (!mountedRef.current) return;
    setResolvedLink(finalLink);
    setStatus("completed");
    onUnlockSuccess(finalLink);
  };

  // 🟢 Opens the ad as a SAME-TAB navigation (never window.open for the ad
  // itself). This is the key mobile fix: window.open("_blank") on phones is
  // frequently either (a) blocked as a popup, or (b) opened as a real
  // background tab whose JS timers get throttled/frozen, so the original
  // tab never reliably learns the user came back. A plain top-level
  // navigation has none of those problems and is never blocked, even when
  // triggered automatically (see the auto-redirect effect below).
  const goToAd = () => {
    let startTime = getValidTimestamp(storagePrefix);
    if (startTime === null) {
      startTime = Date.now();
      safeSet(storagePrefix, String(startTime));
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= COUNTDOWN_SECONDS * 1000) {
      handleComplete();
      return;
    }

    setSecondsLeft(Math.max(1, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000)));
    setStatus("verifying");
    window.location.href = getRandomAdUrl();
  };

  // 🟢 Single source of truth for "where is the user in the flow now",
  // called from every possible re-entry point: first mount, tab regains
  // focus/visibility, AND `pageshow` — which is what actually fires when a
  // page is restored from the back/forward cache after the user presses
  // the phone's back button from the ad page. That `pageshow` case is what
  // was missing before, and is the main reason the button used to get
  // stuck instead of turning into "Start Download" after the wait was over.
  const resync = () => {
    const startTime = getValidTimestamp(storagePrefix);
    if (startTime === null) return;

    const elapsed = Date.now() - startTime;
    if (elapsed >= COUNTDOWN_SECONDS * 1000) {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      handleComplete();
    } else {
      setSecondsLeft(Math.max(1, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000)));
      setStatus("warning");
    }
  };

  useEffect(() => {
    resync();

    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    const onFocus = () => resync();
    const onPageShow = () => resync();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storagePrefix]);

  // 🟢 While on the "you came back early" screen: keep the remaining wait
  // time ticking live, and automatically send the user back to the ad
  // after a short, visible grace period — they don't have to tap anything,
  // but a manual button is still shown as a fallback.
  useEffect(() => {
    if (status !== "warning") {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      return;
    }

    tickTimerRef.current = setInterval(() => {
      const startTime = getValidTimestamp(storagePrefix);
      if (startTime === null) return;
      const elapsed = Date.now() - startTime;
      if (elapsed >= COUNTDOWN_SECONDS * 1000) {
        if (tickTimerRef.current) clearInterval(tickTimerRef.current);
        handleComplete();
      } else {
        setSecondsLeft(Math.max(1, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000)));
      }
    }, 200);

    let graceRemaining = AUTO_REDIRECT_GRACE_MS;
    setRedirectIn(Math.ceil(graceRemaining / 1000));
    const graceTick = setInterval(() => {
      graceRemaining -= 200;
      setRedirectIn(Math.max(0, Math.ceil(graceRemaining / 1000)));
    }, 200);

    redirectTimerRef.current = setTimeout(() => {
      clearInterval(graceTick);
      goToAd();
    }, AUTO_REDIRECT_GRACE_MS);

    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      clearInterval(graceTick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, storagePrefix]);

  const handleStartVerification = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    goToAd();
  };

  const handleFinalDownload = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!resolvedLink || !isSafeUrl(resolvedLink)) {
      alert("Download link එක ලබාගැනීමේ දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.");
      return;
    }

    if (normalizedVariant === "telegram") {
      window.open(resolvedLink.trim(), "_blank", "noopener,noreferrer");
    } else {
      triggerFastNativeDownload(resolvedLink);
    }

    logDownload(subtitleId, normalizedVariant);

    // 🟢 බාගත කිරීම trigger උනාට පස්සේ විතරයි නිහඬව තත්පර 10ක Re-lock timer එක
    // ක්‍රියාත්මක වෙන්නේ. මෙය click-එකෙන්ම fire වෙන නිසා window.open (popup)
    // භාවිතා කිරීම මෙතනට සම්පූර්ණයෙන්ම ආරක්ෂිතයි.
    onDownloadTriggered();
    onClose();
  };

  const circumference = 2 * Math.PI * 32;
  const dashOffset = circumference * (secondsLeft / COUNTDOWN_SECONDS);

  return (
    <AnimatePresence>
      <motion.div
        key="modal-backdrop"
        role="dialog"
        aria-modal="true"
        data-no-ad="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 modal"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          key="modal-card"
          role="document"
          data-no-ad="true"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative w-full max-w-sm rounded-3xl border border-border shadow-2xl overflow-hidden modal-content"
          style={{
            background: "linear-gradient(160deg, oklch(0.20 0.01 20 / 0.98), oklch(0.14 0.008 20 / 0.98))",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-primary" />

          <button
            type="button"
            data-no-ad="true"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition cursor-pointer text-muted-foreground hover:text-foreground z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-5" data-no-ad="true">
            {status === "idle" ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 grid place-items-center">
                  <Lock className="w-8 h-8 text-primary" />
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-foreground">
                    {normalizedVariant === "telegram" ? "Telegram වෙතින් බාගත කිරීමට" : "ඩවුන්ලෝඩ් කරගැනීම සඳහා"}
                  </h3>

                  <div className="p-4 rounded-2xl bg-primary/10 border border-primary/25 text-foreground font-medium text-sm leading-relaxed text-center space-y-2">
                    <p className="text-[15px] font-semibold text-primary-foreground">
                      කරුණාකර පහත බටන් එක ක්ලික් කර තත්පර 5ක් රැදීසිට ආපහු මෙතනට එන්න.
                    </p>
                    <p className="text-amber-400 text-xs font-bold">
                      (ඇඩ් එකෙන් Back බටනයෙන් ආපහු එන්න.)
                    </p>
                    <p className="text-emerald-400 text-xs font-bold">
                      Start Download කියලා කොළපාට Download Button එකක් එයි.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  data-no-ad="true"
                  onClick={handleStartVerification}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-gradient-primary text-primary-foreground text-sm font-bold shadow-glow hover:opacity-90 transition cursor-pointer w-full"
                >
                  Unlock Download | සක්‍රීය කරන්න <ExternalLink className="w-4 h-4" />
                </button>
              </>
            ) : status === "warning" ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 grid place-items-center">
                  <AlertTriangle className="w-8 h-8 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-amber-400">
                    ඔබ ඉක්මනින් ආපසු පැමිණ ඇත!
                  </h3>
                  <p className="mt-2 text-sm text-foreground/90 leading-relaxed font-medium">
                    Download එක සක්‍රිය කිරීමට තව <span className="text-amber-400 font-bold text-base">තත්පර {secondsLeft}ක්</span> අවශ්‍යයි.
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground font-semibold">
                    තත්පර {redirectIn}කින් ඔබව ස්වයංක්‍රීයව නැවත Ad පිටුවට යොමු කරයි...
                  </p>
                </div>
                <button
                  type="button"
                  data-no-ad="true"
                  onClick={handleStartVerification}
                  className="px-6 py-3 rounded-full bg-gradient-primary text-primary-foreground text-sm font-bold shadow-glow hover:opacity-90 transition cursor-pointer w-full"
                >
                  දැන්ම Ad පිටුවට යන්න
                </button>
              </>
            ) : status === "completed" ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 grid place-items-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-400">
                    ඩවුන්ලෝඩ් කිරීමට සූදානම්!
                  </h3>
                  <p className="mt-2 text-sm text-foreground/90 font-medium leading-relaxed">
                    පහත කොළපාට බටන් එක ක්ලික් කර ගොනුව බාගත කරගන්න.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full" data-no-ad="true">
                  <button
                    type="button"
                    data-no-ad="true"
                    data-download="true"
                    onClick={handleFinalDownload}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold text-center transition cursor-pointer w-full shadow-lg active:scale-98"
                  >
                    <Download className="w-4 h-4 text-white" />
                    {normalizedVariant === "telegram" ? "Open in Telegram" : "Start Download | ඩවුන්ලෝඩ් කරන්න"}
                  </button>

                  <button
                    type="button"
                    data-no-ad="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="px-6 py-2 rounded-full bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition cursor-pointer w-full mt-1"
                  >
                    වසන්න
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="32" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="6" />
                    <circle
                      cx="48"
                      cy="48"
                      r="32"
                      fill="none"
                      stroke="url(#ring-gradient)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      style={{ transition: "stroke-dashoffset 0.1s linear" }}
                    />
                    <defs>
                      <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="oklch(0.62 0.24 25)" />
                        <stop offset="100%" stopColor="oklch(0.55 0.25 18)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-extrabold tabular-nums text-gradient leading-none">
                      {secondsLeft}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">sec</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Ad පිටුවට යොමු කරමින්...
                  </h3>
                  <p className="mt-2 text-sm text-foreground/85 font-medium leading-relaxed">
                    ඇඩ් එකේ තත්පර <span className="text-primary font-bold">{secondsLeft}ක්</span> රැඳී{" "}
                    <span className="text-primary font-bold">Back</span> බටනයෙන් ආපසු එන්න.
                  </p>
                </div>

                <div className="w-full h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full bg-gradient-primary rounded-full transition-all"
                    style={{
                      width: `${((COUNTDOWN_SECONDS - secondsLeft) / COUNTDOWN_SECONDS) * 100}%`,
                      transition: "width 0.1s linear",
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function DownloadButton({
  downloadLink,
  subtitleId,
  title,
  label = "Direct Download (.zip)",
  className,
  variant = "primary",
}: {
  downloadLink?: string;
  subtitleId?: string | number;
  title?: string;
  label?: string;
  className?: string;
  variant?: "primary" | "direct" | "telegram";
}) {
  const [showModal, setShowModal] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockedUrl, setUnlockedUrl] = useState<string>(downloadLink || "");

  const reLockTimerRef = useRef<any>(null);

  const normalizedVariant = variant === "telegram" ? "telegram" : "direct";
  const subId = subtitleId || "default";
  const cacheKey = `sub_unlocked_link_${subId}_${normalizedVariant}`;
  const statusKey = `sub_status_${subId}_${normalizedVariant}`;
  const storagePrefix = `sub_ad_${subId}_${normalizedVariant}`;
  const lockExpiryKey = `sub_lock_expiry_${subId}_${normalizedVariant}`;

  const lockButton = () => {
    setIsUnlocked(false);
    setUnlockedUrl("");
    safeRemove(cacheKey);
    safeRemove(statusKey);
    safeRemove(storagePrefix);
    safeRemove(lockExpiryKey);
  };

  const startSilent10SecReLock = () => {
    const expireAt = Date.now() + SILENT_RELOCK_MS;
    safeSet(lockExpiryKey, String(expireAt));

    if (reLockTimerRef.current) clearTimeout(reLockTimerRef.current);
    reLockTimerRef.current = setTimeout(() => {
      lockButton();
    }, SILENT_RELOCK_MS);
  };

  // 🟢 Single resync function, called from mount AND from every event that
  // can signal "the user came back to this page" — including `pageshow`
  // for the mobile back-button/bfcache-restore case that visibilitychange
  // and focus alone don't reliably cover.
  const resyncButtonState = () => {
    const expireAt = getValidTimestamp(lockExpiryKey);
    if (expireAt !== null) {
      if (Date.now() >= expireAt) {
        lockButton();
        return;
      } else {
        const remaining = expireAt - Date.now();
        if (reLockTimerRef.current) clearTimeout(reLockTimerRef.current);
        reLockTimerRef.current = setTimeout(() => {
          lockButton();
        }, remaining);
      }
    }

    const savedLink = safeGet(cacheKey);
    const isReady = safeGet(statusKey) === "true";

    if (isReady && savedLink) {
      setIsUnlocked(true);
      setUnlockedUrl(savedLink);
      return;
    }

    const startTime = getValidTimestamp(storagePrefix);
    if (startTime !== null) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= COUNTDOWN_SECONDS * 1000) {
        setIsUnlocked(true);
        safeSet(statusKey, "true");

        if (downloadLink) {
          setUnlockedUrl(downloadLink);
        } else if (subtitleId) {
          supabase
            .rpc("get_single_download_link", { target_id: Number(subtitleId) })
            .then(({ data, error }) => {
              if (!error && data) {
                const link = normalizedVariant === "telegram" ? data.telegram_link : data.download_link;
                if (link) {
                  setUnlockedUrl(link);
                  safeSet(cacheKey, link);
                }
              }
            })
            .catch(() => {
              /* noop — click-time fallback will retry */
            });
        }
      } else {
        // 🟢 Verification already in progress (user came back early, or the
        // page reloaded/restored from bfcache). Re-open the modal so it can
        // show the live remaining time and auto-redirect — never leave the
        // button looking "locked" while progress is actually saved.
        setShowModal(true);
      }
    }
  };

  useEffect(() => {
    resyncButtonState();

    const onVisible = () => {
      if (document.visibilityState === "visible") resyncButtonState();
    };
    const onFocus = () => resyncButtonState();
    const onPageShow = () => resyncButtonState();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      if (reLockTimerRef.current) clearTimeout(reLockTimerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, statusKey, storagePrefix, lockExpiryKey]);

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isUnlocked) {
      let finalLink = unlockedUrl || downloadLink;

      if (!finalLink && subtitleId) {
        try {
          const { data } = await supabase.rpc("get_single_download_link", {
            target_id: Number(subtitleId),
          });
          if (data) {
            finalLink = normalizedVariant === "telegram" ? data.telegram_link : data.download_link;
            setUnlockedUrl(finalLink);
          }
        } catch {
          /* noop */
        }
      }

      if (finalLink && isSafeUrl(finalLink)) {
        if (normalizedVariant === "telegram") {
          window.open(finalLink.trim(), "_blank", "noopener,noreferrer");
        } else {
          triggerFastNativeDownload(finalLink);
        }
        logDownload(subtitleId, normalizedVariant);
        startSilent10SecReLock();
      } else {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  const handleUnlockSuccess = (link: string) => {
    safeSet(cacheKey, link);
    safeSet(statusKey, "true");
    setUnlockedUrl(link);
    setIsUnlocked(true);
  };

  const buttonClass = className ?? (
    isUnlocked
      ? "inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-[0_4px_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer active:scale-95"
      : normalizedVariant === "telegram"
      ? "inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm shadow-[0_4px_15px_rgba(6,182,212,0.35)] hover:opacity-95 transition cursor-pointer"
      : "inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-gradient-primary text-primary-foreground font-bold text-sm shadow-glow hover:opacity-95 transition cursor-pointer"
  );

  return (
    <>
      <button
        type="button"
        data-no-ad="true"
        data-download="true"
        onClick={handleDownloadClick}
        className={buttonClass}
      >
        {isUnlocked ? (
          <CheckCircle className="w-5 h-5 text-white" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {isUnlocked ? "Download Now | දැන් ඩවුන්ලෝඩ් කරන්න" : label}
      </button>

      {showModal && (
        <DownloadCountdownModal
          downloadLink={unlockedUrl || downloadLink}
          subtitleId={subtitleId}
          title={title}
          variant={variant}
          onClose={() => setShowModal(false)}
          onUnlockSuccess={handleUnlockSuccess}
          onDownloadTriggered={startSilent10SecReLock}
        />
      )}
    </>
  );
}
