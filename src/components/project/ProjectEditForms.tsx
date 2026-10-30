"use client";

import { startTransition, useActionState, useId } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { EditState } from "@/lib/actions/project-edit";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/enums";

type Action = (prev: EditState, fd: FormData) => Promise<EditState>;
const initial: EditState = {};

/**
 * Submit through useActionState without React's automatic form reset: on a
 * validation error the user keeps what they typed instead of losing it.
 */
export function submitWith(formAction: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
}

function Feedback({ state }: { state: EditState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-sev-high bg-sev-high-bg px-3 py-2">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="text-sm text-sev-low bg-sev-low-bg px-3 py-2">
        {state.notice}
      </p>
    );
  }
  return null;
}

const err = (s: EditState, k: string) => s.fieldErrors?.[k];

function FieldError({ state, name }: { state: EditState; name: string }) {
  const m = err(state, name);
  return m ? <span className="text-xs text-sev-high">{m}</span> : null;
}

/** Buttons shared by every edit form: Save, plus Reset which reverts unsaved edits (nothing is saved until Save). */
function Actions({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando…" : label}
      </Button>
      <button type="reset" className="text-xs uppercase tracking-[0.14em] text-ink-faint hover:text-ink transition-colors font-[family-name:var(--font-archivo)]">
        Descartar cambios
      </button>
    </div>
  );
}

export interface ProjectValues {
  name: string;
  variety: string;
  vintage: string;
  vineyard: string;
  origin: string;
  volumeLiters: string;
  alcohol: string;
  startDate: string;
  estimatedAgingMonths: string;
  status: string;
  originKnowledgeKey: string;
  varietyKnowledgeKey: string;
  notes: string;
}

export function ProjectForm({
  action,
  values,
  regions,
  varieties,
}: {
  action: Action;
  values: ProjectValues;
  regions: { key: string; title: string }[];
  varieties: { key: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const f = (name: keyof ProjectValues) => ({ id: `p-${name}`, name, defaultValue: values[name] });
  return (
    <form onSubmit={submitWith(formAction)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del proyecto" htmlFor="p-name">
          <Input {...f("name")} required maxLength={120} />
          <FieldError state={state} name="name" />
        </Field>
        <Field label="Alcohol (% vol.)" htmlFor="p-alcohol" hint="Se muestra en la página de la barrica. Ej. 14,5">
          <Input {...f("alcohol")} inputMode="decimal" />
          <FieldError state={state} name="alcohol" />
        </Field>
        <Field label="Variedad" htmlFor="p-variety">
          <Input {...f("variety")} required maxLength={80} />
          <FieldError state={state} name="variety" />
        </Field>
        <Field label="Añada" htmlFor="p-vintage">
          <Input {...f("vintage")} inputMode="numeric" />
          <FieldError state={state} name="vintage" />
        </Field>
        <Field label="Viñedo" htmlFor="p-vineyard">
          <Input {...f("vineyard")} maxLength={120} />
          <FieldError state={state} name="vineyard" />
        </Field>
        <Field label="Origen (texto)" htmlFor="p-origin">
          <Input {...f("origin")} maxLength={200} />
          <FieldError state={state} name="origin" />
        </Field>
        <Field label="Volumen (L)" htmlFor="p-volumeLiters">
          <Input {...f("volumeLiters")} inputMode="decimal" />
          <FieldError state={state} name="volumeLiters" />
        </Field>
        <Field label="Fecha de llenado" htmlFor="p-startDate">
          <Input {...f("startDate")} type="date" />
          <FieldError state={state} name="startDate" />
        </Field>
        <Field label="Crianza estimada (meses)" htmlFor="p-estimatedAgingMonths">
          <Input {...f("estimatedAgingMonths")} inputMode="numeric" />
          <FieldError state={state} name="estimatedAgingMonths" />
        </Field>
        <Field label="Estado" htmlFor="p-status">
          <Select id="p-status" name="status" defaultValue={values.status}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s as ProjectStatus]}
              </option>
            ))}
          </Select>
          <FieldError state={state} name="status" />
        </Field>
        <Field label="Ficha de origen (conocimiento)" htmlFor="p-originKnowledgeKey" hint="Alimenta el mapa y el texto del origen en la página pública.">
          <Select id="p-originKnowledgeKey" name="originKnowledgeKey" defaultValue={values.originKnowledgeKey}>
            <option value="">Sin ficha</option>
            {regions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ficha de variedad (conocimiento)" htmlFor="p-varietyKnowledgeKey">
          <Select id="p-varietyKnowledgeKey" name="varietyKnowledgeKey" defaultValue={values.varietyKnowledgeKey}>
            <option value="">Sin ficha</option>
            {varieties.map((r) => (
              <option key={r.key} value={r.key}>
                {r.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Notas internas" htmlFor="p-notes">
        <Textarea {...f("notes")} rows={3} maxLength={2000} />
        <FieldError state={state} name="notes" />
      </Field>
      <Feedback state={state} />
      <Actions pending={pending} label="Guardar proyecto" />
    </form>
  );
}

export function StageForm({ action, values }: { action: Action; values: { name: string; startedAt: string; completedAt: string } }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const uid = useId();
  return (
    <form onSubmit={submitWith(formAction)} className="flex flex-col gap-3 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Etapa" htmlFor={`${uid}-name`}>
          <Input id={`${uid}-name`} name="name" defaultValue={values.name} required maxLength={80} />
          <FieldError state={state} name="name" />
        </Field>
        <Field label="Inicio" htmlFor={`${uid}-start`}>
          <Input id={`${uid}-start`} name="startedAt" type="date" defaultValue={values.startedAt} />
          <FieldError state={state} name="startedAt" />
        </Field>
        <Field label="Fin" htmlFor={`${uid}-end`} hint="Vacío = todavía no terminó">
          <Input id={`${uid}-end`} name="completedAt" type="date" defaultValue={values.completedAt} />
          <FieldError state={state} name="completedAt" />
        </Field>
      </div>
      <Feedback state={state} />
      <Actions pending={pending} label="Guardar etapa" />
    </form>
  );
}

export function OperationForm({
  action,
  types,
  values,
  barrel,
}: {
  action: Action;
  types: { id: string; name: string }[];
  values: { operationTypeId: string; date: string; notes: string; customerVisible: boolean; featured: boolean; customerHeadline: string; customerNote: string };
  barrel: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const uid = useId();
  return (
    <form onSubmit={submitWith(formAction)} className="flex flex-col gap-3 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Tipo" htmlFor={`${uid}-type`}>
          <Select id={`${uid}-type`} name="operationTypeId" defaultValue={values.operationTypeId}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <FieldError state={state} name="operationTypeId" />
        </Field>
        <Field label="Fecha" htmlFor={`${uid}-date`}>
          <Input id={`${uid}-date`} name="date" type="date" defaultValue={values.date} required />
          <FieldError state={state} name="date" />
        </Field>
        <div className="flex flex-col gap-1.5 justify-end text-xs text-ink-faint">
          <span className="uppercase tracking-[0.16em] font-[family-name:var(--font-archivo)]">Barrica</span>
          <span className="text-sm text-ink py-2">{barrel ?? "—"}</span>
        </div>
      </div>
      <Field label="Notas internas" htmlFor={`${uid}-notes`}>
        <Textarea id={`${uid}-notes`} name="notes" rows={2} defaultValue={values.notes} maxLength={2000} />
        <FieldError state={state} name="notes" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título para el cliente" htmlFor={`${uid}-headline`}>
          <Input id={`${uid}-headline`} name="customerHeadline" defaultValue={values.customerHeadline} maxLength={120} />
          <FieldError state={state} name="customerHeadline" />
        </Field>
        <Field label="Nota para el cliente" htmlFor={`${uid}-note`}>
          <Input id={`${uid}-note`} name="customerNote" defaultValue={values.customerNote} maxLength={1000} />
          <FieldError state={state} name="customerNote" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-ink-soft">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="customerVisible" defaultChecked={values.customerVisible} className="accent-brass" /> Visible para el cliente
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="featured" defaultChecked={values.featured} className="accent-brass" /> Destacada (momento)
        </label>
      </div>
      <Feedback state={state} />
      <Actions pending={pending} label="Guardar entrada" />
    </form>
  );
}
