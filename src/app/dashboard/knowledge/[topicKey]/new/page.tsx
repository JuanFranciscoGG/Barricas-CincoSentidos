import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { requireStaffSession } from "@/lib/auth-guard";
import { createKnowledgeEntry } from "@/lib/actions/knowledge";

export default async function NewKnowledgeEntryPage({
  params,
}: {
  params: Promise<{ topicKey: string }>;
}) {
  await requireStaffSession();
  const { topicKey } = await params;

  const [topic, topics] = await Promise.all([
    prisma.knowledgeTopic.findUnique({ where: { key: topicKey } }),
    prisma.knowledgeTopic.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!topic) notFound();

  return (
    <div className="max-w-xl">
      <Link
        href={`/dashboard/knowledge/${topic.key}`}
        className="text-sm text-ink-faint hover:text-ink"
      >
        ← {topic.label}
      </Link>
      <h1 className="text-2xl font-medium mb-1 mt-2">Nueva entrada</h1>
      <p className="text-sm text-ink-soft mb-6">
        Concisa y elegante, no una enciclopedia: 3 a 5 datos y un párrafo que explique por qué importa
        para este vino.
      </p>

      <form action={createKnowledgeEntry} className="flex flex-col gap-4">
        <Field label="Categoría" htmlFor="topicId">
          <Select id="topicId" name="topicId" defaultValue={topic.id} required>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Clave" htmlFor="key" hint="Se normaliza sola — ej. agrelo-lujan-de-cuyo">
          <Input id="key" name="key" placeholder="agrelo-lujan-de-cuyo" required />
        </Field>
        <Field label="Título" htmlFor="title">
          <Input id="title" name="title" placeholder="Agrelo" required />
        </Field>
        <Field label="Línea secundaria" htmlFor="locationLine" hint="Opcional — ej. Luján de Cuyo, Mendoza, Argentina">
          <Input id="locationLine" name="locationLine" />
        </Field>
        <Field
          label="Gancho corto"
          htmlFor="teaser"
          hint='Una frase, en segunda persona ("tu vino/tu barrica") — es lo que se ve antes de abrir "Descubrí más"'
        >
          <Textarea id="teaser" name="teaser" rows={2} />
        </Field>
        <Field
          label="Datos"
          htmlFor="factChips"
          hint="Una línea por dato, formato Etiqueta: Valor — ej. Ubicación, Elevación, Clima, Suelo, Riego"
        >
          <Textarea
            id="factChips"
            name="factChips"
            rows={4}
            placeholder={"Elevación: ~940–1.050 m\nSuelo: Aluvional, franco arenoso"}
          />
        </Field>
        <Field label="Relato" htmlFor="narrative" hint="La explicación detallada, de uso interno.">
          <Textarea id="narrative" name="narrative" rows={6} required />
        </Field>
        <Field
          label="Fuentes (interno)"
          htmlFor="sources"
          hint="Una línea por fuente, formato Etiqueta: URL — nunca se muestra al cliente"
        >
          <Textarea id="sources" name="sources" rows={3} placeholder={"Wines of Argentina: https://winesofargentina.org"} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" name="status" value="published" className="accent-brass" />
          Publicar ahora
        </label>
        <Button type="submit" className="mt-1">
          Guardar entrada
        </Button>
      </form>
    </div>
  );
}
