import React, { useEffect, useState } from "react";
import { ShieldAlert, Check, LogOut } from "lucide-react";

// දින 2ක් සඳහා මිලිතත්පර ප්‍රමාණය (2 * 24 * 60 * 60 * 1000)
const TWO_DAYS_MS = 172800000; 

export function AgeGate(): React.JSX.Element | null {
  const [isVerified, setIsVerified] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    try {
      const verifiedTime = localStorage.getItem("age_verified_time");
      
      if (verifiedTime) {
        const savedTime = parseInt(verifiedTime, 10);
        const currentTime = Date.now();

        // දින 2ක කාලය තවමත් ඉතිරිව තිබේදැයි බලයි
        if (currentTime - savedTime < TWO_DAYS_MS) {
          setIsVerified(true);
        } else {
          // කාලය අවසන් නම් පරණ දත්ත ඉවත් කර නැවත age gate එක පෙන්වයි
          localStorage.removeItem("age_verified_time");
          setIsVerified(false);
        }
      } else {
        setIsVerified(false);
      }
    } catch {
      // localStorage භාවිතය සීමා වී ඇත්නම් overlay එක පෙන්වයි
      setIsVerified(false);
    }
  }, []);

  const handleConfirm = (): void => {
    try {
      // තහවුරු කළ වත්මන් වේලාව සුරැකීම
      localStorage.setItem("age_verified_time", Date.now().toString());
    } catch {
      /* noop */
    }
    setIsVerified(true);
    
    // Adsterra ලින්ක් එක වෙත redirect කිරීම
    window.location.href = "https://acorntar.com/b795sywmp?key=20b07ce2b76b7238eae7acf49dd3a534";
  };

  const handleExit = (): void => {
    window.location.href = "https://www.google.com";
  };

  // පළමු වතාවට load වීමට පෙර පෙනීම වැළැක්වීමට
  if (!mounted) return null;
  if (isVerified) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
      style={{
        background: "rgba(0, 0, 0, 0.92)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-border/60 p-8 text-center flex flex-col items-center gap-6"
        style={{
          background: "linear-gradient(160deg, oklch(0.20 0.01 20 / 0.98), oklch(0.14 0.008 20 / 0.98))",
        }}
      >
        {/* Top glow strip */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-red-500 to-amber-500 opacity-80 rounded-t-3xl" />

        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 grid place-items-center animate-pulse">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>

        {/* Headings */}
        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">
            Age Verification <br />
            <span className="text-sm font-normal text-muted-foreground block mt-1">වයස තහවුරු කිරීම</span>
          </h2>
        </div>

        {/* Message body */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            This website may contain advertisements with 18+ content. Please confirm that you are at least 18 years old to proceed.
          </p>
          <div className="h-[1px] w-full bg-border/40" />
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            මෙම වෙබ් අඩවියෙහි 18+ දැන්වීම් අඩංගු විය හැක. ඉදිරියට යාම සඳහා ඔබගේ වයස අවුරුදු 18 හෝ ඊට වැඩි බව කරුණාකර තහවුරු කරන්න.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2.5 w-full mt-2">
          <button
            onClick={handleConfirm}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-red-500 to-amber-500 text-white text-sm font-bold shadow-[0_4px_20px_rgba(239,68,68,0.25)] hover:opacity-95 transition cursor-pointer w-full"
          >
            <Check className="w-4 h-4" /> Yes, I am 18+ | ඔව්, මට 18+
          </button>

          <button
            onClick={handleExit}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-semibold transition cursor-pointer w-full"
          >
            <LogOut className="w-3.5 h-3.5" /> No, Exit | නැත, පිටවන්න
          </button>
        </div>
      </div>
    </div>
  );
}
