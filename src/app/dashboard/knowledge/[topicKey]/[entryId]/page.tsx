import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { requireStaffSession } from "@/lib/auth-guard";
import { updateKnowledgeEntry } from "@/lib/actions/knowledge";
import { KNOWLEDGE_STATUS_LABELS, KNOWLEDGE_STATUSES, type KnowledgeStatus } from "@/lib/enums";
import { DeleteEntryButton } from "./DeleteEntryButton";

function statusTone(status: string): "low" | "med" | "neutral" {
  if (status === "published") return "low";
  if (status === "draft") return "med";
  return "neutral";
}

export default async function KnowledgeEntryPage({
  params,
}: {
  params: Promise<{ topicKey: string; entryId: string }>;
}) {
  await requireStaffSession();
  const { topicKey, entryId } = await params;

  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: entryId },
    include: { topic: true },
  });
  if (!entry || entry.topic.key !== topicKey) notFound();

  const topics = await prisma.knowledgeTopic.findMany({ orderBy: { sortOrder: "asc" } });

  let chips: { label: string; value: string }[] = [];
  try {
    chips = JSON.parse(entry.factChips);
  } catch {
    chips = [];
  }
  const chipLines = chips.map((c) => `${c.label}: ${c.value}`).join("\n");

  let sources: { label: string; url: string }[] = [];
  try {
    sources = entry.sources ? JSON.parse(entry.sources) : [];
  } catch {
    sources = [];
  }
  const sourceLines = sources.map((s) => `${s.label}: ${s.url}`).join("\n");

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <div>
        <Link
          href={`/dashboard/knowledge/${entry.topic.key}`}
          className="text-sm text-ink-faint hover:text-ink"
        >
          ← {entry.topic.label}
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap mt-2">
          <div>
            <h1 className="text-2xl font-medium font-display">{entry.title}</h1>
            {entry.locationLine && <p className="text-ink-soft mt-0.5">{entry.locationLine}</p>}
          </div>
          <Badge tone={statusTone(entry.status)}>
            {KNOWLEDGE_STATUS_LABELS[entry.status as KnowledgeStatus] ?? entry.status}
          </Badge>
        </div>
      </div>

      {/* Read view — only sections with real content ever render. */}
      <div className="flex flex-col gap-6">
        {chips.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">
              Ficha técnica
            </h2>
            <Card className="p-0 overflow-hidden">
              <dl className="divide-y divide-line">
                {chips.map((c, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                    <dt className="text-sm text-ink-soft shrink-0">{c.label}</dt>
                    <dd className="text-sm text-right">{c.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </section>
        )}

        {entry.teaser && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">
              Resumen para el cliente
            </h2>
            <Card className="border-brass/40 bg-brass-tint/40">
              <p className="font-display text-lg leading-snug">{entry.teaser}</p>
            </Card>
          </section>
        )}

        {entry.narrative && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">
              Explicación detallada
            </h2>
            <p className="text-sm leading-relaxed text-ink">{entry.narrative}</p>
          </section>
        )}

        {sources.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">
              Fuentes <span className="normal-case text-ink-faint">(interno, nunca visible al cliente)</span>
            </h2>
            <ul className="flex flex-col gap-1">
              {sources.map((s, i) => (
                <li key={i} className="text-sm">
                  <span className="text-ink-soft">{s.label}: </span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brass-strong hover:underline break-all"
                  >
                    {s.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <details className="border-t border-line pt-5">
        <summary className="text-sm font-semibold cursor-pointer select-none text-ink-soft hover:text-ink">
          Editar entrada
        </summary>

        <form action={updateKnowledgeEntry} className="flex flex-col gap-4 mt-4">
          <input type="hidden" name="id" value={entry.id} />
          <Field label="Categoría" htmlFor="topicId">
            <Select id="topicId" name="topicId" defaultValue={entry.topicId} required>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Título" htmlFor="title">
            <Input id="title" name="title" defaultValue={entry.title} required />
          </Field>
          <Field label="Línea secundaria" htmlFor="locationLine">
            <Input id="locationLine" name="locationLine" defaultValue={entry.locationLine ?? ""} />
          </Field>
          <Field
            label="Gancho corto"
            htmlFor="teaser"
            hint='Una frase, en segunda persona ("tu vino/tu barrica") — el resumen para el cliente'
          >
            <Textarea id="teaser" name="teaser" rows={2} defaultValue={entry.teaser ?? ""} />
          </Field>
          <Field
            label="Datos"
            htmlFor="factChips"
            hint="Una línea por dato, formato Etiqueta: Valor — ej. Ubicación, Elevación, Clima, Suelo, Riego"
          >
            <Textarea id="factChips" name="factChips" rows={4} defaultValue={chipLines} />
          </Field>
          <Field label="Relato" htmlFor="narrative" hint="La explicación detallada, de uso interno.">
            <Textarea id="narrative" name="narrative" rows={6} defaultValue={entry.narrative} required />
          </Field>
          <Field
            label="Fuentes (interno)"
            htmlFor="sources"
            hint="Una línea por fuente, formato Etiqueta: URL — nunca se muestra al cliente"
          >
            <Textarea id="sources" name="sources" rows={3} defaultValue={sourceLines} />
          </Field>
          <Field label="Estado" htmlFor="status">
            <Select id="status" name="status" defaultValue={entry.status}>
              {KNOWLEDGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {KNOWLEDGE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" className="mt-1">
            Guardar cambios
          </Button>
        </form>

        <div className="flex justify-end mt-6 pt-4 border-t border-line">
          <DeleteEntryButton id={entry.id} title={entry.title} />
        </div>
      </details>
    </div>
  );
}
