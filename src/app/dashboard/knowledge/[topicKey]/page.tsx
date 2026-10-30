import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { requireStaffSession } from "@/lib/auth-guard";
import { renameKnowledgeCategory, moveKnowledgeEntry } from "@/lib/actions/knowledge";
import { KNOWLEDGE_STATUS_LABELS, type KnowledgeStatus } from "@/lib/enums";

export default async function KnowledgeCategoryPage({
  params,
}: {
  params: Promise<{ topicKey: string }>;
}) {
  await requireStaffSession();
  const { topicKey } = await params;

  const topic = await prisma.knowledgeTopic.findUnique({
    where: { key: topicKey },
    include: { entries: { orderBy: { sortOrder: "asc" } } },
  });
  if (!topic) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard/knowledge" className="text-sm text-ink-faint hover:text-ink">
          ← Conocimiento
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap mt-2">
          <h1 className="text-2xl font-medium">{topic.label}</h1>
          <Link href={`/dashboard/knowledge/${topic.key}/new`}>
            <Button>Nueva entrada</Button>
          </Link>
        </div>
        <details className="mt-2">
          <summary className="text-sm text-ink-faint hover:text-ink cursor-pointer select-none">
            Renombrar categoría
          </summary>
          <form
            action={renameKnowledgeCategory}
            className="flex items-center gap-2 mt-2 max-w-sm"
          >
            <input type="hidden" name="id" value={topic.id} />
            <input
              name="label"
              defaultValue={topic.label}
              required
              className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:outline-2 focus:outline-brass focus:border-brass"
            />
            <Button type="submit" variant="secondary" size="sm">
              Guardar
            </Button>
          </form>
        </details>
      </div>

      <Card className="p-0 overflow-hidden">
        <ul className="divide-y divide-line">
          {topic.entries.map((e, i) => (
            <li key={e.id} className="flex items-center gap-2 px-2 py-1.5">
              <div className="flex flex-col shrink-0">
                <ReorderButton id={e.id} direction="up" disabled={i === 0} />
                <ReorderButton id={e.id} direction="down" disabled={i === topic.entries.length - 1} />
              </div>
              <Link
                href={`/dashboard/knowledge/${topic.key}/${e.id}`}
                className="flex-1 flex items-center justify-between gap-4 px-3 py-3 rounded-md hover:bg-surface-2"
              >
                <div>
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
          {topic.entries.length === 0 && (
            <li className="px-5 py-6 flex flex-col items-start gap-3">
              <span className="text-sm text-ink-faint">Todavía no hay entradas en esta categoría.</span>
              <Link href={`/dashboard/knowledge/${topic.key}/new`}>
                <Button size="sm">+ Agregar conocimiento</Button>
              </Link>
            </li>
          )}
        </ul>
      </Card>
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
    <form action={moveKnowledgeEntry}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={direction === "up" ? "Subir entrada" : "Bajar entrada"}
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
