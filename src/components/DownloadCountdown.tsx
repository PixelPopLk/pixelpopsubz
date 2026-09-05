import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Lock, AlertTriangle, CheckCircle, X, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
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

// 🚀 Fast Native Download Function (Phone Notification එක සහිතව)
function triggerFastNativeDownload(rawUrl: string, title?: string) {
  try {
    const cleanTitle = title ? title.replace(/[/\\?%*:|"<>]/g, "-").trim() : "Subtitle";
    
    // File extension එක (.zip / .rar / .srt) හඳුනාගැනීම
    const extMatch = rawUrl.split("?")[0].match(/\.(zip|rar|7z|srt|sub)$/i);
    const extension = extMatch ? extMatch[1].toLowerCase() : "zip";
    const fileName = `${cleanTitle} Sinhala Sub - PixelPopLK.${extension}`;

    // Supabase එකට direct attachment header එක යැවීම (?download=filename)
    const downloadUrl = rawUrl.includes("?")
      ? `${rawUrl}&download=${encodeURIComponent(fileName)}`
      : `${rawUrl}?download=${encodeURIComponent(fileName)}`;

    // Native Browser Download එක trigger කිරීම
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.setAttribute("download", fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    window.location.href = rawUrl;
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
  title,
  variant = "direct",
  onClose,
  onUnlockSuccess,
}: DownloadCountdownModalProps) {
  const [status, setStatus] = useState<"idle" | "verifying" | "warning" | "completed">("idle");
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [resolvedLink, setResolvedLink] = useState<string>(downloadLink || "");

  const blurTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const timerRef = useRef<any>(null);
  const isPageVisibleRef = useRef<boolean>(true);

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

  useEffect(() => {
    if (status !== "verifying") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const isVisible = document.visibilityState === "visible";
    isPageVisibleRef.current = isVisible;
    if (!isVisible) {
      blurTimeRef.current = Date.now();
    } else {
      blurTimeRef.current = null;
    }

    const updateTimer = () => {
      const now = Date.now();
      let currentSessionTime = 0;
      if (blurTimeRef.current !== null) {
        currentSessionTime = now - blurTimeRef.current;
      }
      const totalMs = accumulatedTimeRef.current + currentSessionTime;
      const remainingSeconds = Math.max(0, COUNTDOWN_SECONDS - Math.floor(totalMs / 1000));
      setSecondsLeft(remainingSeconds);

      if (totalMs >= COUNTDOWN_SECONDS * 1000) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleComplete();
      }
    };

    timerRef.current = setInterval(updateTimer, 100);

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      const now = Date.now();

      if (isVisible) {
        isPageVisibleRef.current = true;
        if (blurTimeRef.current !== null) {
          accumulatedTimeRef.current += now - blurTimeRef.current;
          blurTimeRef.current = null;
        }

        if (timerRef.current) clearInterval(timerRef.current);

        if (accumulatedTimeRef.current < COUNTDOWN_SECONDS * 1000) {
          setStatus("warning");
        } else {
          handleComplete();
        }
      } else {
        isPageVisibleRef.current = false;
        blurTimeRef.current = now;
      }
    };

    const handleBlur = () => {
      const now = Date.now();
      if (isPageVisibleRef.current) {
        isPageVisibleRef.current = false;
        blurTimeRef.current = now;
      }
    };

    const handleFocus = () => {
      const now = Date.now();
      if (!isPageVisibleRef.current) {
        isPageVisibleRef.current = true;
        if (blurTimeRef.current !== null) {
          accumulatedTimeRef.current += now - blurTimeRef.current;
          blurTimeRef.current = null;
        }

        if (timerRef.current) clearInterval(timerRef.current);

        if (accumulatedTimeRef.current < COUNTDOWN_SECONDS * 1000) {
          setStatus("warning");
        } else {
          handleComplete();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [status]);

  const handleStartVerification = (e: React.MouseEvent) => {
    e.stopPropagation();
    const activeAdUrl = getRandomAdUrl();
    try {
      const w = window.open(activeAdUrl, "_blank", "noopener");
      if (w) w.opener = null;
    } catch {
      /* noop */
    }
    blurTimeRef.current = Date.now();
    setStatus("verifying");
  };

  // 🟢 Start Download Button එක Click කළ විට (Fast Native Download)
  const handleFinalDownload = (e: React.MouseEvent) => {
    e.stopPropagation(); // Ad listener එකෙන් මේ click එක අල්ලන එක 100% නවත්වනවා

    if (!resolvedLink || !isSafeUrl(resolvedLink)) {
      alert("Invalid or unsafe download link detected.");
      return;
    }

    setDownloadStarted(true);

    if (variant === "telegram") {
      window.open(resolvedLink, "_blank", "noopener");
    } else {
      triggerFastNativeDownload(resolvedLink, title);
    }

    logDownload(subtitleId, variant);

    // තත්පර 2කින් modal එක close කිරීම
    setTimeout(() => {
      onClose();
    }, 2000);
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
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          key="modal-card"
          role="document"
          data-no-ad="true"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative w-full max-w-sm rounded-3xl border border-border shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] overflow-hidden modal-content"
          style={{
            background: "linear-gradient(160deg, oklch(0.20 0.01 20 / 0.98), oklch(0.14 0.008 20 / 0.98))",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-primary opacity-80" />

          <button
            type="button"
            data-no-ad="true"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition cursor-pointer text-muted-foreground hover:text-foreground z-10"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="p-8 flex flex-col items-center text-center gap-5" data-no-ad="true">
            {status === "idle" ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 grid place-items-center">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground leading-snug">
                    {variant === "telegram" ? "Open Telegram Subtitle" : "Unlock Your Download"} <br />
                    <span className="text-[11px] font-normal text-muted-foreground block mt-1">
                      ඩවුන්ලෝඩ් ලින්ක් එක ලබා ගැනීමට
                    </span>
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Please visit our sponsor link for just <span className="text-primary font-semibold">5 seconds</span> to unlock your file.
                    <span className="block text-[11px] mt-1 text-muted-foreground/75">
                      කරුණාකර පහත බටන් එක ක්ලික් කර තත්පර 5ක් රැඳී සිටින්න.
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  data-no-ad="true"
                  onClick={handleStartVerification}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-primary text-primary-foreground text-sm font-bold shadow-glow hover:opacity-90 transition cursor-pointer w-full"
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
                  <h3 className="text-base font-bold text-foreground">
                    Verification Paused <br />
                    <span className="text-[11px] font-normal text-amber-400/80 block mt-1">තහවුරු කිරීම නැවතී ඇත!</span>
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    You returned too early! Please stay on the sponsor page for at least{" "}
                    <span className="text-amber-400 font-semibold">{secondsLeft} more seconds</span> to unlock.
                    <span className="block text-[11px] mt-1.5 text-muted-foreground/80">
                      කරුණාකර තව තත්පර {secondsLeft}ක් අනුග්‍රාහක පිටුවේ රැඳී සිටින්න.
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  data-no-ad="true"
                  onClick={handleStartVerification}
                  className="px-6 py-2.5 rounded-full bg-gradient-primary text-primary-foreground text-sm font-bold shadow-glow hover:opacity-90 transition cursor-pointer w-full"
                >
                  Resume Unlocking | නැවත උත්සාහ කරන්න
                </button>
              </>
            ) : status === "completed" ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 grid place-items-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {downloadStarted ? "Download Started!" : "Download Unlocked!"} <br />
                    <span className="text-[11px] font-normal text-emerald-400/80 block mt-1">
                      {downloadStarted ? "බාගත කිරීම ආරම්භ විය!" : "ඩවුන්ලෝඩ් කිරීමට සූදානම්!"}
                    </span>
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {downloadStarted ? (
                      <span className="text-emerald-400 font-medium">
                        Check your device notification bar. <br />
                        ඔබගේ දුරකථනයේ Notification තීරුව පරීක්ෂා කරන්න.
                      </span>
                    ) : (
                      <span>
                        Your secure file is ready. Click below to download. <br />
                        <span className="text-[11px] text-muted-foreground/80">පහත බටන් එක ක්ලික් කර බාගත කරගන්න.</span>
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full" data-no-ad="true">
                  {/* 🟢 මේ Button එකෙන් කිසිම Ad එකක් Play නොවේ, Direct Fast Download වේ */}
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
                        Downloading... | බාගත වෙමින්...
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
                    Close | වසන්න
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
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Lock className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-widest text-primary">
                      Verifying Sponsor Visit
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    Verifying ad view... <br />
                    <span className="text-[11px] font-normal text-muted-foreground block mt-1">
                      දැන්වීම පරීක්ෂා කරමින් පවතී...
                    </span>
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    Please stay on the sponsor page for{" "}
                    <span className="text-foreground font-semibold">
                      {secondsLeft} second{secondsLeft !== 1 ? "s" : ""}
                    </span>.
                    <span className="block text-[11px] mt-1 text-muted-foreground/80">
                      කරුණාකර තව තත්පර {secondsLeft}ක් අනුග්‍රාහක පිටුවේ රැඳී සිටින්න.
                    </span>
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
                  className="text-xs text-primary/80 hover:text-primary underline cursor-pointer"
                >
                  Sponsor page closed? Click to reopen | නැවත විවෘත කරන්න
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

  const cacheKey = `unlocked_${subtitleId || downloadLink}`;

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(cacheKey);
      if (saved) {
        setIsUnlocked(true);
        setUnlockedUrl(saved);
      }
    } catch {
      /* noop */
    }
  }, [cacheKey]);

  // Unlock වී ඇත්නම් ක්ෂණික Direct Native Download
  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isUnlocked && unlockedUrl) {
      if (isSafeUrl(unlockedUrl)) {
        if (variant === "telegram") {
          window.open(unlockedUrl, "_blank", "noopener");
        } else {
          triggerFastNativeDownload(unlockedUrl, title);
        }
        logDownload(subtitleId, variant);
      } else {
        alert("Invalid or unsafe download link detected.");
      }
    } else {
      setShowModal(true);
    }
  };

  const handleUnlockSuccess = (link: string) => {
    try {
      sessionStorage.setItem(cacheKey, link);
    } catch {
      /* noop */
    }
    setUnlockedUrl(link);
    setIsUnlocked(true);
  };

  const buttonClass = className ?? (
    variant === "telegram"
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
          <CheckCircle className="w-4 h-4 text-emerald-400" />
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
