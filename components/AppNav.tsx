"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";

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

export function AppNav() {
  const pathname = usePathname();
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    fetch("/api/review/count")
      .then((r) => r.json())
      .then((data) => setReviewCount(Number(data.count) || 0))
      .catch(() => setReviewCount(0));
  }, [pathname]);

  return (
    <aside>
      <Link href="/" className="brand">
        <Icon name="pool" size={20} />
        Contact pool
      </Link>
      <nav>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={item.match(pathname) ? "on" : undefined}>
            <Icon name={item.icon} size={18} />
            {item.label}
            {item.badge && reviewCount > 0 ? <span className="nav-badge">{reviewCount}</span> : null}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
