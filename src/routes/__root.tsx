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
// තත්පර 15 cooldown කාලය (milliseconds වලින්)
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
    // 1. User Ad එකෙන් "Back" පැමිණි විට ස්වයංක්‍රීයව target පිටුවට Redirect කිරීම (Auto-navigation)
    const checkPendingNavigation = () => {
      if (window.location.pathname.startsWith("/manage-admin")) return;

      const pendingNav = sessionStorage.getItem("pending_target_url");
      if (pendingNav) {
        sessionStorage.removeItem("pending_target_url");
        // කලින් click කළ page එකට auto redirect වෙනවා
        window.location.href = pendingNav;
      }
    };

    checkPendingNavigation();
    window.addEventListener("pageshow", checkPendingNavigation);

    // 2. Click Handler - Cards, Buttons, Sidebar සඳහා
    const handleGlobalClick = (event: MouseEvent) => {
      if (window.location.pathname.startsWith("/manage-admin")) return;

      const target = event.target as HTMLElement;

      // AgeGate overlay එක click කරද්දී ad නොපෙන්වීමට
      if (target.closest(".age-gate, [data-age-gate]")) return;

      // Click කළ element එක හෝ එහි parent එක <a> හෝ <button> ද කියා සොයා ගැනීම
      const clickable = target.closest("a, button") as HTMLElement | null;
      if (!clickable) return;

      // Link එකක් නම් එහි destination URL එක ලබා ගැනීම
      const linkElement = clickable.closest("a") as HTMLAnchorElement | null;
      const targetUrl = linkElement ? linkElement.href : null;

      // Click කළ button එක / card එක හඳුනාගැනීමට Unique Key එකක් සෑදීම
      const itemKey =
        targetUrl ||
        clickable.id ||
        clickable.getAttribute("data-id") ||
        (clickable.innerText ? clickable.innerText.trim().slice(0, 30) : "btn");

      // Cooldowns පරීක්ෂා කිරීම (තත්පර 15ක් ගොස් ඇත්දැයි බැලීමට)
      let cooldowns: Record<string, number> = {};
      try {
        cooldowns = JSON.parse(sessionStorage.getItem("ad_cooldowns") || "{}");
      } catch (e) {
        cooldowns = {};
      }

      const now = Date.now();
      const lastClickedTime = cooldowns[itemKey];

      // අදාළ button එක තත්පර 15 ඇතුළත click කර ඇත්නම් ad එක පෙන්වන්නේ නැත (සාමාන්‍ය ලෙස වැඩ කරයි)
      if (lastClickedTime && now - lastClickedTime < COOLDOWN_TIME) {
        return;
      }

      // තත්පර 15න් පසු හෝ පළමු වරට click කළේ නම්:
      cooldowns[itemKey] = now;
      sessionStorage.setItem("ad_cooldowns", JSON.stringify(cooldowns));

      // Link එකක් නම් user back පැමිණි පසු auto redirect වීමට save කරගන්නවා
      if (targetUrl && !targetUrl.includes(AD_URL)) {
        sessionStorage.setItem("pending_target_url", targetUrl);
      }

      // Event එක නවතා Ad එකට redirect කිරීම
      event.preventDefault();
      event.stopPropagation();
      window.location.href = AD_URL;
    };

    document.addEventListener("click", handleGlobalClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleGlobalClick, { capture: true });
      window.removeEventListener("pageshow", checkPendingNavigation);
    };
  }, [isAdminPage]);

  return (
    <QueryClientProvider client={queryClient}>
      <AgeGate />
      <Outlet />
    </QueryClientProvider>
  );
  }
