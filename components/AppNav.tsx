"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark, Icon, type IconName } from "@/components/icons";
import { APP_NAME, NAV_COLLAPSED_KEY, NAV_COLLAPSED_KEY_LEGACY, THEME_KEY } from "@/lib/brand";

const items: { href: string; label: string; icon: IconName; match: (path: string) => boolean; badge?: true }[] = [
  {
    href: "/",
    label: "Contacts",
    icon: "people",
    match: (path) => path === "/" || path.startsWith("/contacts"),
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    icon: "campaign",
    match: (path) => path.startsWith("/campaigns"),
  },
  {
    href: "/review",
    label: "Review",
    icon: "inbox",
    match: (path) => path.startsWith("/review"),
    badge: true,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "settings",
    match: (path) => path.startsWith("/settings"),
  },
];

function readCollapsed() {
  const current = window.localStorage.getItem(NAV_COLLAPSED_KEY);
  if (current === "1" || current === "0") return current === "1";
  return window.localStorage.getItem(NAV_COLLAPSED_KEY_LEGACY) === "1";
}

export function AppNav() {
  const pathname = usePathname();
  const [reviewCount, setReviewCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setCollapsed(readCollapsed());
    const stored = document.documentElement.getAttribute("data-theme");
    setTheme(stored === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    fetch("/api/review/count")
      .then((r) => r.json())
      .then((data) => setReviewCount(Number(data.count) || 0))
      .catch(() => setReviewCount(0));
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(THEME_KEY, next);
  }

  return (
    <aside className={collapsed ? "collapsed" : undefined}>
      <div className="brand-row">
        <Link href="/" className="brand" title={APP_NAME}>
          <BrandMark size={28} />
          <span className="brand-name">{APP_NAME}</span>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-controls="app-nav"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleCollapsed}
        >
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={18} />
        </button>
      </div>
      <nav id="app-nav">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={item.match(pathname) ? "on" : undefined}
            title={item.label}
          >
            <Icon name={item.icon} size={18} />
            <span className="nav-label">{item.label}</span>
            {item.badge && reviewCount > 0 ? <span className="nav-badge">{reviewCount}</span> : null}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        className="theme-toggle"
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        title={theme === "dark" ? "Light" : "Dark"}
        onClick={toggleTheme}
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
        <span className="nav-label">{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
    </aside>
  );
}
