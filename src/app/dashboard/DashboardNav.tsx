"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Hoy" },
  { href: "/dashboard/customers", label: "Clientes" },
  { href: "/dashboard/barrels", label: "Barricas" },
  { href: "/dashboard/operation-types", label: "Tipos de operación" },
  { href: "/dashboard/knowledge", label: "Conocimiento" },
];

export function DashboardNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const visible = isAdmin ? [...links.slice(0, 3), { href: "/dashboard/owners", label: "Dueños" }, ...links.slice(3)] : links;

  return (
    <div className="max-w-6xl mx-auto px-4 max-md:[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent_100%)] max-md:[-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent_100%)]">
      <nav className="flex gap-1 overflow-x-auto">
        {visible.map((link) => {
          const active =
            link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[0.7rem] uppercase tracking-[0.16em] font-[family-name:var(--font-archivo)] transition-colors ${
                active
                  ? "border-brass text-ink"
                  : "border-transparent text-ink-faint hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <div className="shrink-0 w-3" aria-hidden />
      </nav>
    </div>
  );
}
