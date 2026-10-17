import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata = {
  title: "PuzzleTogether — Multiplayer Jigsaw Puzzles",
  description:
    "Solve jigsaw puzzles together in real-time with room codes. Authentic puzzle notches, custom images, and no account required.",
  keywords: "jigsaw puzzle, multiplayer, online puzzle, co-op puzzle, room code, real-time",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#090A10",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
