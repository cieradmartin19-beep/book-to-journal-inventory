import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "The Paper Curio",
  description: "Curated Books • Handmade Journals • Creative Collections",
  icons: {
    icon: "/paper-curio-logo.png",
    apple: "/paper-curio-logo.png"
  },
  openGraph: {
    title: "The Paper Curio",
    description: "Curated Books • Handmade Journals • Creative Collections",
    type: "website",
    siteName: "The Paper Curio"
  },
  twitter: {
    card: "summary",
    title: "The Paper Curio",
    description: "Curated Books • Handmade Journals • Creative Collections"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
