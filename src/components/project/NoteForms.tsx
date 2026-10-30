"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { submitWith } from "@/components/project/ProjectEditForms";
import type { NoteState } from "@/lib/actions/barrel-notes";

type Action = (prev: NoteState, fd: FormData) => Promise<NoteState>;
const initial: NoteState = {};

function Feedback({ state }: { state: NoteState }) {
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

const fe = (s: NoteState, k: string) => (s.fieldErrors?.[k] ? <span className="text-xs text-sev-high">{s.fieldErrors[k]}</span> : null);

export function NewNoteForm({ action, barrels }: { action: Action; barrels: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);
  // Empty the form only after a successful publish; on an error the user keeps what they typed.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} onSubmit={submitWith(formAction)} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Barrica" htmlFor="n-barrel">
          <Select id="n-barrel" name="barrelId" defaultValue={barrels.length === 1 ? barrels[0].id : ""} required>
            {barrels.length !== 1 && (
              <option value="" disabled>
                Elegir barrica…
              </option>
            )}
            {barrels.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
          {fe(state, "barrelId")}
        </Field>
        <Field label="Fecha de publicación (opcional)" htmlFor="n-date" hint="Vacío = ahora mismo">
          <Input id="n-date" name="publishedAt" type="datetime-local" />
          {fe(state, "publishedAt")}
        </Field>
      </div>
      <Field label="Título" htmlFor="n-title">
        <Input id="n-title" name="title" required maxLength={120} placeholder="Hoy oxigenamos tu barrica" />
        {fe(state, "title")}
      </Field>
      <Field label="Descripción (opcional)" htmlFor="n-body">
        <Textarea id="n-body" name="body" rows={3} maxLength={1000} placeholder="Oxigenamos cuidadosamente el vino como parte de su maduración." />
        {fe(state, "body")}
      </Field>
      <Feedback state={state} />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Publicando…" : "Publicar nota"}
        </Button>
      </div>
    </form>
  );
}

export function NoteForm({
  saveAction,
  deleteAction,
  values,
  barrel,
}: {
  saveAction: Action;
  deleteAction: Action;
  values: { title: string; body: string; publishedAt: string };
  barrel: string;
}) {
  const [state, formAction, pending] = useActionState(saveAction, initial);
  const [delState, delAction, deleting] = useActionState(deleteAction, initial);
  return (
    <div className="py-4 flex flex-col gap-3">
      <form onSubmit={submitWith(formAction)} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label={`Título · ${barrel}`} htmlFor={`t-${values.publishedAt}-${values.title.length}`}>
            <Input name="title" defaultValue={values.title} required maxLength={120} />
            {fe(state, "title")}
          </Field>
          <Field label="Publicada" htmlFor={`d-${values.publishedAt}`}>
            <Input name="publishedAt" type="datetime-local" defaultValue={values.publishedAt} required />
            {fe(state, "publishedAt")}
          </Field>
        </div>
        <Field label="Descripción" htmlFor={`b-${values.publishedAt}`}>
          <Textarea name="body" rows={2} defaultValue={values.body} maxLength={1000} />
          {fe(state, "body")}
        </Field>
        <Feedback state={state} />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : "Guardar nota"}
          </Button>
          <button type="reset" className="text-xs uppercase tracking-[0.14em] text-ink-faint hover:text-ink transition-colors font-[family-name:var(--font-archivo)]">
            Descartar cambios
          </button>
        </div>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirm("¿Eliminar esta nota? Deja de mostrarse en «Lo último» y no se puede deshacer.")) return;
          startTransition(() => delAction(new FormData()));
        }}
      >
        <Button type="submit" variant="danger" size="sm" disabled={deleting}>
          {deleting ? "Eliminando…" : "Eliminar nota"}
        </Button>
      </form>
      {delState.error && (
        <p role="alert" className="text-sm text-sev-high bg-sev-high-bg px-3 py-2">
          {delState.error}
        </p>
      )}
    </div>
  );
}
