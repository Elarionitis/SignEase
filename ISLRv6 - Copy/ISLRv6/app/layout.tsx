import { Metadata } from 'next';
import "./globals.css";
import { Inter } from "next/font/google";

// Add Inter font with proper configuration
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "SignEase - Real-time Sign Language Recognition",
  description: "Break communication barriers with AI-powered sign language translation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        {/* Preconnect to origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Preload critical fonts */}
        <link rel="preload" href="/fonts/pacifico-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="bg-[#030303] min-h-screen">
        {children}
      </body>
    </html>
  );
}
