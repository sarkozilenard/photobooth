import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "PHOTO BOOTH",
  description: "iPhone + iPad DIY fotóautomata",
  applicationName: "PHOTO BOOTH",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PHOTO BOOTH",
  },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hu"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-black font-sans text-white">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
