import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AgeGate } from "../components/AgeGate";

// 🟢 Ad Link එක
const AD_URL = "https://acorntar.com/mavhdyhj78?key=dc67dd9ce96dd9a20b59e14a01a6a093";
// තත්පර 15 cooldown කාලය
const COOLDOWN_TIME = 15000;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PixelPopLK — Sinhala Subtitles" },
      { name: "description", content: "Premium Sinhala subtitles for movies and TV series. Curated, fast, and secure downloads." },
      { name: "keywords", content: "Sinhala Subtitles, Download Movie Subtitles, PixelPopLK, Sinhala Subitiles TV Series, Sinhala Subtitles TV Series, subtitle download, sri lanka subtitles" },
      { name: "author", content: "PixelPopLK" },
      { property: "og:title", content: "PixelPopLK — Sinhala Subtitles" },
      { property: "og:description", content: "Premium Sinhala subtitles for movies and TV series. Curated, fast, and secure downloads." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "PixelPopLK" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "PixelPopLK — Sinhala Subtitles" },
      { name: "twitter:description", content: "Premium Sinhala subtitles for movies and TV series." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "PixelPopLK",
  "url": "https://pixelpoplk.pages.dev",
  "description": "Premium Sinhala subtitles for movies and TV series. Curated, fast, and secure downloads.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://pixelpoplk.pages.dev/?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

function RootShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/manage-admin");

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <meta name="google-site-verification" content="VoErL02EHeHtDv46aBcjIEm5DpUTnJRhPF89ewoK-M4" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body>
        {children}
        <Scripts />

        {/* 🟢 Adsterra Social Bar — load වන්නේ admin පිටුවල නොවේ නම් පමණි */}
        {!isAdminPage && (
          <script async src="https://acorntar.com/f9/ab/d2/f9abd27b8744d3a0411d6b53882e464a.js" />
        )}
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/manage-admin");

  useEffect(() => {
    // Global Click Handler
    const handleGlobalClick = (event: MouseEvent) => {
      // 1. Admin පිටුවක නම් ad run නොවේ
      if (window.location.pathname.startsWith("/manage-admin")) return;

      const target = event.target as HTMLElement;
      if (!target) return;

      // 🛑 2. Popup Messages, Dialogs, Modals, Toasts, AgeGate සම්පූර්ණයෙන්ම ignore කිරීම (Freeze වීම වැළැක්වීම)
      const isInsidePopup = target.closest(
        '[role="dialog"], [role="alertdialog"], [aria-modal="true"], ' +
        '.modal, .dialog, .popup, [data-radix-dialog-content], ' +
        '[data-sonner-toast], [data-toast], .toast, [role="alert"], ' +
        '.age-gate, [data-age-gate], [class*="overlay"], [class*="backdrop"]'
      );
      if (isInsidePopup) return;

      // Click කළ element එක <a>, <button> හෝ clickable card එකක්දැයි සොයා ගැනීම
      const clickable = target.closest("a, button, [role='button'], [data-clickable='true']") as HTMLElement | null;
      if (!clickable) return;

      const linkElement = clickable.closest("a") as HTMLAnchorElement | null;
      const targetUrl = linkElement ? linkElement.href : null;

      // 🛑 3. Normal Download Buttons ignore කිරීම
      const isDownloadButton =
        clickable.hasAttribute("download") ||
        Boolean(clickable.closest("[download], [data-download]")) ||
        (typeof clickable.className === "string" && /download/i.test(clickable.className)) ||
        (clickable.id && /download/i.test(clickable.id)) ||
        (clickable.textContent && /download|බාගන්න/i.test(clickable.textContent)) ||
        (targetUrl && (/\.(srt|zip|rar|7z|sub)($|\?)/i.test(targetUrl) || /download/i.test(targetUrl)));

      // 🛑 4. Telegram Download / Channel Buttons ignore කිරීම
      const isTelegramButton =
        Boolean(targetUrl && /(t\.me|telegram\.me|telegram\.dog)/i.test(targetUrl)) ||
        Boolean(clickable.textContent && /telegram|ටෙලිග්‍රෑම්/i.test(clickable.textContent)) ||
        (typeof clickable.className === "string" && /telegram/i.test(clickable.className)) ||
        (clickable.id && /telegram/i.test(clickable.id));

      // Download හෝ Telegram buttons නම් Ad එක Skip කර සාමාන්‍ය ලෙස යාමට ඉඩ දීම
      if (isDownloadButton || isTelegramButton) {
        return;
      }

      // Click කළ button එක / card එක හඳුනාගැනීමට Key එකක් සෑදීම
      const itemKey =
        targetUrl ||
        clickable.id ||
        clickable.getAttribute("data-id") ||
        (clickable.textContent ? clickable.textContent.trim().slice(0, 30) : "btn");

      // Cooldowns පරීක්ෂා කිරීම (තත්පර 15)
      let cooldowns: Record<string, number> = {};
      try {
        cooldowns = JSON.parse(sessionStorage.getItem("ad_cooldowns") || "{}");
      } catch {
        cooldowns = {};
      }

      const now = Date.now();
      const lastClickedTime = cooldowns[itemKey];

      // අදාළ card එක/button එක තත්පර 15 ඇතුළත click කර ඇත්නම් Ad open කරන්නේ නෑ
      if (lastClickedTime && now - lastClickedTime < COOLDOWN_TIME) {
        return;
      }

      // අලුතින් click කළ විට කාලය සටහන් කරගන්නවා
      cooldowns[itemKey] = now;
      sessionStorage.setItem("ad_cooldowns", JSON.stringify(cooldowns));

      // 🚀 ප්‍රධාන විසඳුම:
      // Current tab එකේ Reacher එකට හෝ Anime filter එකට යාමට ඉඩ දී, Ad එක New Tab එකකින් open කිරීම!
      // Event එක block (preventDefault) නොකරන නිසා කිසිම button එකක් freeze නොවේ.
      try {
        const adWindow = window.open(AD_URL, "_blank");
        if (adWindow) {
          adWindow.blur();
          window.focus();
        }
      } catch (e) {
        // Pop-up block වුවහොත් fallback ක්‍රමය
        const a = document.createElement("a");
        a.href = AD_URL;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };

    // Bubble phase එකේදීම අල්ලා ගන්නා බැවින් React components වලට බාධා නොවේ
    document.addEventListener("click", handleGlobalClick);

    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [isAdminPage]);

  return (
    <QueryClientProvider client={queryClient}>
      <AgeGate />
      <Outlet />
    </QueryClientProvider>
  );
}
