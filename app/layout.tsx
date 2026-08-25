import "./globals.css";
import { IBM_Plex_Sans } from "next/font/google";
import { AppNav } from "@/components/AppNav";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata = {
  title: "Contact pool",
  description: "Reusable LinkedIn audience and campaign queue",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={plex.className}>
        <div className="shell">
          <AppNav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
