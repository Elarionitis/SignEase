import { Metadata } from 'next';
import "./globals.css";

const inter = { variable: "font-sans" };

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
      <body className="bg-[#030303] min-h-screen">
        {children}
      </body>
    </html>
  );
}
