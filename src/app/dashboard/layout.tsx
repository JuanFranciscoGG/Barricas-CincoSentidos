import Image from "next/image";
import { requireStaffSession } from "@/lib/auth-guard";
import { ROLE_LABELS, type Role } from "@/lib/enums";
import { logout } from "@/lib/actions/auth";
import { DashboardNav } from "./DashboardNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffSession();

  return (
    <div className="dash min-h-dvh flex flex-col">
      <header className="border-b-2 border-ink bg-bg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/brand/hand-mark.png" alt="" width={24} height={24} />
            <span className="font-display text-lg tracking-[0.01em]">Cinco Sentidos <span className="text-ink-faint">· Barricas</span></span>
          </div>
          <div className="flex items-center gap-3 text-xs tracking-[0.04em] font-[family-name:var(--font-archivo)]">
            <span className="text-ink-soft hidden sm:inline">
              {session.name} · {ROLE_LABELS[session.role as Role]}
            </span>
            <form action={logout}>
              <button className="text-ink-faint hover:text-brass underline underline-offset-4 transition-colors">
                Salir
              </button>
            </form>
          </div>
        </div>
        <DashboardNav isAdmin={session.role === "owner_admin"} />
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
