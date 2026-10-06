import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/toast";
import { getSessionUser } from "@/lib/auth-server";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

/**
 * Applies the stored light/dark/system choice before the first paint so the
 * page never flashes the wrong theme. ThemeProvider takes over afterwards.
 */
const THEME_INIT = `(function(){try{var t=localStorage.getItem("nishant-care-theme");var dark=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch(e){}})();`;

export const metadata: Metadata = {
  title: {
    default: "Nishant Care",
    template: "%s · Nishant Care",
  },
  description:
    "Chat with Nishant Care to learn about doctors, check availability and book appointments conversationally.",
  applicationName: "Nishant Care",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolved on the server from the httpOnly cookie so the first paint already
  // knows whether the visitor is signed in.
  const user = await getSessionUser();

  return (
    <html
      lang="en"
      className={`h-full antialiased ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <ThemeProvider>
          <AuthProvider initialUser={user}>
            <SiteHeader />
            <div className="flex flex-1 flex-col">{children}</div>
            <SiteFooter />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
