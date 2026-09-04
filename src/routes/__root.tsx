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
import { AgeGate } from "../components/AgeGate"; // AgeGate.tsx ගොනුව import කිරීම

// 🟢 ඔබ ලබාදුන් Ad Link එක
const AD_URL = "https://acorntar.com/mavhdyhj78?key=dc67dd9ce96dd9a20b59e14a01a6a093";

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
      { property: "og:title", primary: "PixelPopLK — Sinhala Subtitles" },
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
  
  // URL path එක "/manage-admin" වලින් ආරම්භ වේ දැයි පරීක්ෂා කිරීම
  const isAdminPage = location.pathname.startsWith("/manage-admin");

  return (
    <html lang="en">
      <head>
        <HeadContent />
        
        {/* Google Search Console Verification Meta Tag */}
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
    // Admin පිටුවේ නම් මේ Ad click listener එක run වෙන්නේ නෑ
    if (isAdminPage) return;

    const handleGlobalClick = (event: MouseEvent) => {
      // Path එක Admin නම් ආරක්ෂිත පියවරක් ලෙස නවත්වනවා
      if (window.location.pathname.startsWith("/manage-admin")) return;

      const target = event.target as HTMLElement;
      // Button එකක් හෝ Link එකක් (a tag) click වුණාද බලනවා
      const clickable = target.closest("button, a");

      if (clickable) {
        // User කලින් ad එක බැලුවදැයි පරීක්ෂා කිරීම
        const hasSeenAd = sessionStorage.getItem("hasSeenAd");

        if (!hasSeenAd) {
          // Ad එක බැලූ බව සටහන් කරගන්නවා
          sessionStorage.setItem("hasSeenAd", "true");

          // Button එකේ සාමාන්‍ය navigation එක නවත්වා Ad එකට redirect කරනවා
          event.preventDefault();
          event.stopPropagation();
          window.location.href = AD_URL;
        }
      }
    };

    // Capture phase එකේදීම click එක අල්ලගන්නවා
    document.addEventListener("click", handleGlobalClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleGlobalClick, { capture: true });
    };
  }, [isAdminPage]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* 18+ Age Gate overlay එක */}
      <AgeGate />

      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
        }
