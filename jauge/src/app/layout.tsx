import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/session";
import "./globals.css";

const sans = IBM_Plex_Sans({ variable: "--font-sans-app", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono-app", subsets: ["latin"], weight: ["500"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: { default: t("name"), template: `%s · ${t("name")}` }, description: t("tagline"), manifest: "/manifest.webmanifest" };
}

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f5f1" }, { media: "(prefers-color-scheme: dark)", color: "#131311" }],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const theme = (await currentUser())?.preferences.theme ?? "system";
  return (
    <html lang={locale} data-theme={theme} className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
