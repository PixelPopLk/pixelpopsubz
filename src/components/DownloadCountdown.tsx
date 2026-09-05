import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Lock, AlertTriangle, CheckCircle, X, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase, logDownload } from "@/integrations/supabase/client";

const MONETAG_URL = "https://acorntar.com/fncjyve9?key=a347a729277e7dcc5e07924adff80652";
const ADSTERRA_URL = "https://acorntar.com/b795sywmp?key=20b07ce2b76b7238eae7acf49dd3a534";

const COUNTDOWN_SECONDS = 5;

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

// 🚀 Fast Native Download (කිසිදු 400 Error එකක් නැතිව)
function triggerFastNativeDownload(rawUrl: string) {
  try {
    const cleanUrl = rawUrl.split("?")[0].trim();
    const a = document.createElement("a");
    a.href = cleanUrl;
    a.setAttribute("download", "");
    a.setAttribute("target", "_self");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    window.location.href = rawUrl.split("?")[0].trim();
  }
}

interface DownloadCountdownModalProps {
  downloadLink?: string;
  subtitleId?: string | number;
  title?: string;
  variant?: string;
  onClose: () => void;
  onUnlockSuccess: (link: string) => void;
}

export function DownloadCountdownModal({
  downloadLink,
  subtitleId,
  variant = "direct",
  onClose,
  onUnlockSuccess,
}: DownloadCountdownModalProps) {
  const [status, setStatus] = useState<"idle" | "verifying" | "warning" | "completed">("idle");
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [resolvedLink, setResolvedLink] = useState<string>(downloadLink || "");

  const timerRef = useRef<any>(null);
  const storagePrefix = `sub_ad_${subtitleId || "default"}`;

  // Link එක ලබාගෙන Completed තත්ත්වයට පත් කිරීම
  const handleComplete = async () => {
    let finalLink = downloadLink || "";

    if (!finalLink && subtitleId) {
      try {
        const { data, error } = await supabase.rpc("get_single_download_link", {
          target_id: Number(subtitleId),
        });

        if (!error && data) {
          finalLink = variant === "telegram" ? data.telegram_link : data.download_link;
        }
      } catch (err) {
        console.error("Error fetching link:", err);
      }
    }

    setResolvedLink(finalLink);
    setStatus("completed");
    onUnlockSuccess(finalLink);
  };

  // 🟢 Modal එක Open වෙද්දී කලින් Ad එක බලලා ඉවරදැයි පරීක්ෂා කිරීම (Refresh වුණත් වැඩ කරයි)
  useEffect(() => {
    try {
      const startTimeStr = localStorage.getItem(storagePrefix);
      if (startTimeStr) {
        const elapsed = Date.now() - parseInt(startTimeStr, 10);
        if (elapsed >= COUNTDOWN_SECONDS * 1000) {
          handleComplete();
          return;
        } else {
          // තව තත්පර කිහිපයක් ඉතිරිව ඇත්නම්
          const remaining = Math.max(1, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000));
          setSecondsLeft(remaining);
          setStatus("warning");
        }
      }
    } catch {
      /* noop */
    }
  }, []);

  // Verification Timer එක
  useEffect(() => {
    if (status !== "verifying") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const checkTime = () => {
      try {
        const startTimeStr = localStorage.getItem(storagePrefix);
        if (!startTimeStr) return;
        const elapsed = Date.now() - parseInt(startTimeStr, 10);
        const remaining = Math.max(0, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000));
        setSecondsLeft(remaining);

        if (elapsed >= COUNTDOWN_SECONDS * 1000) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleComplete();
        }
      } catch {
        /* noop */
      }
    };

    timerRef.current = setInterval(checkTime, 200);

    // User නැවත tab එකට ආ විට පරීක්ෂා කිරීම
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        try {
          const startTimeStr = localStorage.getItem(storagePrefix);
          if (startTimeStr) {
            const elapsed = Date.now() - parseInt(startTimeStr, 10);
            if (elapsed >= COUNTDOWN_SECONDS * 1000) {
              if (timerRef.current) clearInterval(timerRef.current);
              handleComplete();
            } else {
              setSecondsLeft(Math.max(1, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000)));
              setStatus("warning");
            }
          }
        } catch {
          /* noop */
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [status]);

  const handleStartVerification = (e: React.MouseEvent) => {
    e.stopPropagation();

    // 🟢 ආරම්භ කළ වෙලාව Phone එකේ ස්ථිරව Save කරගන්නවා
    try {
      localStorage.setItem(storagePrefix, String(Date.now()));
    } catch {
      /* noop */
    }

    const activeAdUrl = getRandomAdUrl();
    try {
      const w = window.open(activeAdUrl, "_blank", "noopener");
      if (w) w.opener = null;
    } catch {
      /* noop */
    }

    setSecondsLeft(COUNTDOWN_SECONDS);
    setStatus("verifying");
  };

  const handleFinalDownload = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!resolvedLink || !isSafeUrl(resolvedLink)) {
      alert("Download link එක ලබාගැනීමේ දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.");
      return;
    }

    setDownloadStarted(true);

    if (variant === "telegram") {
      window.open(resolvedLink.trim(), "_blank", "noopener");
    } else {
      triggerFastNativeDownload(resolvedLink);
    }

    logDownload(subtitleId, variant);

    setTimeout(() => {
      onClose();
    }, 1500);
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
                    {variant === "telegram" ? "Telegram වෙතින් බාගත කිරීමට" : "ඩවුන්ලෝඩ් කරගැනීම සඳහා"}
                  </h3>

                  <div className="p-4 rounded-2xl bg-primary/10 border border-primary/25 text-foreground font-medium text-sm leading-relaxed text-center space-y-2">
                    <p className="text-[15px] font-semibold text-primary-foreground">
                      කරුණාකර පහත බටන් එක ක්ලික් කර තත්පර 5ක් රැදීසිට ආපහු මෙතනට එන්න.
                    </p>
                    <p className="text-amber-400 text-xs font-bold">
                      (ඇඩ් එකෙන් බැක් වෙන්න.)
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
                    තහවුරු කිරීම නැවතී ඇත!
                  </h3>
                  <p className="mt-2 text-sm text-foreground/90 leading-relaxed font-medium">
                    ඔබ නියමිත කාලයට පෙර ආපසු පැමිණ ඇත! <br />
                    කරුණාකර තව <span className="text-amber-400 font-bold text-base">තත්පර {secondsLeft}ක්</span> අනුග්‍රාහක පිටුවේ රැඳී සිටින්න.
                  </p>
                </div>
                <button
                  type="button"
                  data-no-ad="true"
                  onClick={handleStartVerification}
                  className="px-6 py-3 rounded-full bg-gradient-primary text-primary-foreground text-sm font-bold shadow-glow hover:opacity-90 transition cursor-pointer w-full"
                >
                  නැවත උත්සාහ කරන්න
                </button>
              </>
            ) : status === "completed" ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 grid place-items-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-400">
                    {downloadStarted ? "බාගත කිරීම ආරම්භ විය!" : "ඩවුන්ලෝඩ් කිරීමට සූදානම්!"}
                  </h3>
                  <p className="mt-2 text-sm text-foreground/90 font-medium leading-relaxed">
                    {downloadStarted ? (
                      "ඔබගේ දුරකථනයේ Notification තීරුව පරීක්ෂා කරන්න."
                    ) : (
                      "පහත කොළපාට බටන් එක ක්ලික් කර ගොනුව බාගත කරගන්න."
                    )}
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
                    {downloadStarted ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-white animate-pulse" />
                        බාගත වෙමින් පවතී...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-white" />
                        {variant === "telegram" ? "Open in Telegram" : "Start Download | ඩවුන්ලෝඩ් කරන්න"}
                      </>
                    )}
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
                    දැන්වීම පරීක්ෂා කරමින් පවතී...
                  </h3>
                  <p className="mt-2 text-sm text-foreground/85 font-medium leading-relaxed">
                    කරුණාකර තව <span className="text-primary font-bold">{secondsLeft} තත්පරයක්</span> අනුග්‍රාහක පිටුවේ රැඳී සිටින්න.
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

                <button
                  type="button"
                  data-no-ad="true"
                  onClick={handleStartVerification}
                  className="text-xs text-primary/90 hover:text-primary underline cursor-pointer"
                >
                  පිටුව වැසුණාද? නැවත විවෘත කරන්න
                </button>
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

  const cacheKey = `sub_unlocked_link_${subtitleId || "default"}`;
  const statusKey = `sub_status_${subtitleId || "default"}`;

  // 🟢 Page එක Reload වුණත් Phone එකේ Storage එකෙන් අඳුරගෙන කෙලින්ම කොළ පාට Button එක පෙන්වීම
  useEffect(() => {
    try {
      const savedLink = localStorage.getItem(cacheKey);
      const isReady = localStorage.getItem(statusKey) === "true";

      if (isReady && savedLink) {
        setIsUnlocked(true);
        setUnlockedUrl(savedLink);
      } else {
        // අදාළ Subtitle එකට තත්පර 5 ගෙවිලාදැයි බැලීම
        const startTimeStr = localStorage.getItem(`sub_ad_${subtitleId || "default"}`);
        if (startTimeStr) {
          const elapsed = Date.now() - parseInt(startTimeStr, 10);
          if (elapsed >= COUNTDOWN_SECONDS * 1000) {
            setIsUnlocked(true);
            localStorage.setItem(statusKey, "true");
          }
        }
      }
    } catch {
      /* noop */
    }
  }, [cacheKey, statusKey, subtitleId]);

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Unlock වී ඇත්නම් ක්ෂණික Direct Download
    if (isUnlocked) {
      let finalLink = unlockedUrl || downloadLink;

      if (!finalLink && subtitleId) {
        try {
          const { data } = await supabase.rpc("get_single_download_link", {
            target_id: Number(subtitleId),
          });
          if (data) {
            finalLink = variant === "telegram" ? data.telegram_link : data.download_link;
            setUnlockedUrl(finalLink);
          }
        } catch {
          /* noop */
        }
      }

      if (finalLink && isSafeUrl(finalLink)) {
        if (variant === "telegram") {
          window.open(finalLink.trim(), "_blank", "noopener");
        } else {
          triggerFastNativeDownload(finalLink);
        }
        logDownload(subtitleId, variant);
      } else {
        // Link එකක් නැත්නම් Modal එක open කර ලබා ගැනීම
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  const handleUnlockSuccess = (link: string) => {
    try {
      localStorage.setItem(cacheKey, link);
      localStorage.setItem(statusKey, "true");
    } catch {
      /* noop */
    }
    setUnlockedUrl(link);
    setIsUnlocked(true);
  };

  const buttonClass = className ?? (
    isUnlocked
      ? "inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-[0_4px_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer active:scale-95"
      : variant === "telegram"
      ? "inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm shadow-[0_4px_15px_rgba(6,182,212,0.35)] hover:opacity-95 transition cursor-pointer"
      : "inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-gradient-primary text-primary-foreground font-bold text-sm shadow-glow hover:opacity-95 transition cursor-pointer"
  );

  return (
    <>
      {/* 🟢 Page එක Reload වුණත් මේ Button එක කොළ පාට වී "Download Now" ලෙස පවතී */}
      <button
        type="button"
        data-no-ad="true"
        data-download="true"
        onClick={handleDownloadClick}
        className={buttonClass}
      >
        {isUnlocked ? (
          <CheckCircle className="w-5 h-5 text-white animate-pulse" />
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
        />
      )}
    </>
  );
}
