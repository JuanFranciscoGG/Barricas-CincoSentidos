import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { requireStaffSession } from "@/lib/auth-guard";
import { createKnowledgeCategory, moveKnowledgeCategory } from "@/lib/actions/knowledge";
import { KNOWLEDGE_STATUS_LABELS, type KnowledgeStatus } from "@/lib/enums";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaffSession();
  const { q } = await searchParams;
  const query = q?.trim();

  if (query) {
    const matches = await prisma.knowledgeEntry.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { key: { contains: query, mode: "insensitive" } },
          { locationLine: { contains: query, mode: "insensitive" } },
          { narrative: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { topic: true },
      orderBy: [{ topic: { sortOrder: "asc" } }, { title: "asc" }],
      take: 50,
    });

    return (
      <div className="flex flex-col gap-6">
        <KnowledgeHeader query={query} />
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-line">
            {matches.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/dashboard/knowledge/${e.topic.key}/${e.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2"
                >
                  <div>
                    <span className="text-xs uppercase tracking-wide text-brass-strong font-semibold">
                      {e.topic.label}
                    </span>
                    <span className="block font-display text-lg">{e.title}</span>
                    {e.locationLine && (
                      <span className="block text-sm text-ink-soft">{e.locationLine}</span>
                    )}
                  </div>
                  <Badge tone={statusTone(e.status)}>
                    {KNOWLEDGE_STATUS_LABELS[e.status as KnowledgeStatus] ?? e.status}
                  </Badge>
                </Link>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-5 py-6 text-sm text-ink-faint">
                Sin resultados para &ldquo;{query}&rdquo;.
              </li>
            )}
          </ul>
        </Card>
      </div>
    );
  }

  const topics = await prisma.knowledgeTopic.findMany({
    orderBy: { sortOrder: "asc" },
    include: { entries: { select: { status: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <KnowledgeHeader query={query} />

      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-line">
            {topics.map((topic, i) => {
              const activeCount = topic.entries.filter((e) => e.status !== "archived").length;
              return (
                <li key={topic.id} className="flex items-center gap-2 px-2 py-1.5">
                  <div className="flex flex-col shrink-0">
                    <ReorderButton id={topic.id} direction="up" disabled={i === 0} />
                    <ReorderButton id={topic.id} direction="down" disabled={i === topics.length - 1} />
                  </div>
                  <Link
                    href={`/dashboard/knowledge/${topic.key}`}
                    className="flex-1 flex items-center justify-between gap-4 px-3 py-3 rounded-md hover:bg-surface-2"
                  >
                    <span className="font-display text-lg">{topic.label}</span>
                    {activeCount > 0 ? (
                      <span className="text-sm text-ink-soft shrink-0">
                        {activeCount} {activeCount === 1 ? "entrada" : "entradas"}
                      </span>
                    ) : (
                      <span className="text-sm text-ink-faint shrink-0">Sin entradas todavía</span>
                    )}
                  </Link>
                </li>
              );
            })}
            {topics.length === 0 && (
              <li className="px-5 py-6 text-sm text-ink-faint">Todavía no hay categorías.</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle>Nueva categoría</CardTitle>
          <p className="text-xs text-ink-faint mb-3">
            Ej. &ldquo;Regiones&rdquo;, &ldquo;Variedades de uva&rdquo;, &ldquo;Barricas y roble&rdquo;.
          </p>
          <form action={createKnowledgeCategory} className="flex flex-col gap-3">
            <Field label="Nombre" htmlFor="label">
              <Input id="label" name="label" placeholder="Nombre de la categoría" required />
            </Field>
            <Button type="submit" className="mt-1">
              Crear categoría
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function KnowledgeHeader({ query }: { query?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium">Conocimiento</h1>
          <p className="text-sm text-ink-soft mt-1 max-w-2xl">
            Cada entrada se escribe una sola vez y la reutiliza cualquier proyecto que cite la misma
            clave. Una entrada en borrador simplemente no aparece — nunca se muestra un relato genérico
            de relleno.
          </p>
        </div>
      </div>
      <form action="/dashboard/knowledge" className="flex gap-2 max-w-md">
        <Input name="q" defaultValue={query ?? ""} placeholder="Buscar en toda la biblioteca…" />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>
    </div>
  );
}

function ReorderButton({
  id,
  direction,
  disabled,
}: {
  id: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moveKnowledgeCategory}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={direction === "up" ? "Subir categoría" : "Bajar categoría"}
        className="w-6 h-4 flex items-center justify-center text-ink-faint hover:text-ink disabled:opacity-20 disabled:pointer-events-none leading-none text-xs"
      >
        {direction === "up" ? "▲" : "▼"}
      </button>
    </form>
  );
}

function statusTone(status: string): "low" | "med" | "neutral" {
  if (status === "published") return "low";
  if (status === "draft") return "med";
  return "neutral";
}
