"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

const items: { href: string; label: string; icon: IconName; match: (path: string) => boolean }[] = [
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
          </Link>
        ))}
      </nav>
    </aside>
  );
}
