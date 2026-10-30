import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  createOperationType,
  updateOperationType,
  moveOperationType,
  setOperationTypeActive,
  deleteOperationType,
} from "@/lib/actions/operations";
import {
  OPERATION_CATEGORIES,
  OPERATION_CATEGORY_LABELS,
  isOperationCategory,
} from "@/lib/operation-catalog";

function CategorySelect({ defaultValue }: { defaultValue: string }) {
  return (
    <Select name="category" defaultValue={defaultValue}>
      {OPERATION_CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {OPERATION_CATEGORY_LABELS[c]}
        </option>
      ))}
    </Select>
  );
}

export default async function OperationTypesPage() {
  const types = await prisma.operationType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { operations: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-medium">Tipos de operación</h1>
        <p className="text-sm text-ink-soft mt-1 max-w-2xl">
          El catálogo que ves al registrar una operación, en este orden. Es una guía, no una secuencia
          obligatoria: siempre se puede elegir cualquier tipo. Los tipos con historial no se borran, se
          archivan, y los registros anteriores conservan su nombre.
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start">
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-line">
            {types.map((t, i) => (
              <li key={t.id} className={t.active ? "" : "bg-bg-alt/50"}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex flex-col shrink-0">
                    <form action={moveOperationType}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button
                        type="submit"
                        disabled={i === 0}
                        aria-label={`Subir ${t.name}`}
                        className="px-2 text-ink-soft hover:text-brass-strong disabled:opacity-30 disabled:pointer-events-none"
                      >
                        ▲
                      </button>
                    </form>
                    <form action={moveOperationType}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button
                        type="submit"
                        disabled={i === types.length - 1}
                        aria-label={`Bajar ${t.name}`}
                        className="px-2 text-ink-soft hover:text-brass-strong disabled:opacity-30 disabled:pointer-events-none"
                      >
                        ▼
                      </button>
                    </form>
                  </div>

                  <details className="group flex-1 min-w-0">
                    <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: t.color ?? "var(--brass)" }}
                        />
                        <span className={`truncate ${t.active ? "" : "text-ink-faint line-through"}`}>
                          {t.name}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {!t.active && <Badge tone="med">Archivado</Badge>}
                        <Badge tone="neutral">
                          {isOperationCategory(t.category) ? OPERATION_CATEGORY_LABELS[t.category] : t.category}
                        </Badge>
                        <span className="text-xs text-ink-faint group-open:hidden">Editar</span>
                      </span>
                    </summary>

                    <div className="mt-4 flex flex-col gap-4 pb-1">
                      {t.description && <p className="text-sm text-ink-soft">{t.description}</p>}
                      <form action={updateOperationType} className="flex flex-col gap-3">
                        <input type="hidden" name="id" value={t.id} />
                        <Field label="Nombre" htmlFor={`name-${t.id}`}>
                          <Input id={`name-${t.id}`} name="name" defaultValue={t.name} required />
                        </Field>
                        <Field label="Descripción" htmlFor={`desc-${t.id}`}>
                          <Textarea id={`desc-${t.id}`} name="description" rows={3} defaultValue={t.description ?? ""} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Tipo de paso" htmlFor={`cat-${t.id}`}>
                            <CategorySelect defaultValue={t.category} />
                          </Field>
                          <Field label="Color" htmlFor={`color-${t.id}`}>
                            <Input
                              id={`color-${t.id}`}
                              name="color"
                              type="color"
                              defaultValue={t.color ?? "#8c6e34"}
                              className="h-10"
                            />
                          </Field>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-ink-soft">
                          <input
                            type="checkbox"
                            name="defaultCustomerVisible"
                            defaultChecked={t.defaultCustomerVisible}
                            className="accent-brass"
                          />
                          Visible para el cliente por defecto
                        </label>
                        <div>
                          <Button type="submit" size="sm">
                            Guardar cambios
                          </Button>
                        </div>
                      </form>

                      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <form action={setOperationTypeActive}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="active" value={t.active ? "false" : "true"} />
                          <Button type="submit" variant="secondary" size="sm">
                            {t.active ? "Archivar" : "Reactivar"}
                          </Button>
                        </form>
                        <form action={deleteOperationType}>
                          <input type="hidden" name="id" value={t.id} />
                          <Button type="submit" variant="danger" size="sm">
                            Eliminar
                          </Button>
                        </form>
                        <span className="text-xs text-ink-faint">
                          {t._count.operations > 0
                            ? `${t._count.operations} registros: eliminar lo archiva.`
                            : "Sin registros: se elimina del todo."}
                        </span>
                      </div>
                    </div>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Nuevo tipo</CardTitle>
          <form action={createOperationType} className="flex flex-col gap-3 mt-3">
            <Field label="Nombre" htmlFor="name">
              <Input id="name" name="name" placeholder="Ej. Descube" required />
            </Field>
            <Field label="Descripción" htmlFor="description">
              <Textarea id="description" name="description" rows={3} />
            </Field>
            <Field label="Tipo de paso" htmlFor="category" hint="Inicial, recurrente, condicional o final.">
              <CategorySelect defaultValue="recurring" />
            </Field>
            <Field label="Color" htmlFor="color" hint="Opcional, para distinguirlo en el historial.">
              <Input id="color" name="color" type="color" defaultValue="#8c6e34" className="h-10" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" name="defaultCustomerVisible" className="accent-brass" />
              Visible para el cliente por defecto
            </label>
            <Button type="submit" className="mt-1">
              Crear tipo
            </Button>
            <p className="text-xs text-ink-faint">Se agrega al final; subilo con ▲ donde corresponda.</p>
          </form>
        </Card>
      </div>
    </div>
  );
}
