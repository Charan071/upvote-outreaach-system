import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { APP_NAME, APP_TAGLINE, THEME_KEY } from "@/lib/brand";

export const metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

const themeBoot = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t!=="light"&&t!=="dark")t="dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <div className="shell">
          <AppNav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
