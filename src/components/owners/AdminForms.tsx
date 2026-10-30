"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { CopyButton } from "@/components/CopyButton";
import type { AdminState } from "@/lib/actions/owners-admin";

type Action = (prev: AdminState, fd: FormData) => Promise<AdminState>;
const initial: AdminState = {};

function Feedback({ state }: { state: AdminState }) {
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

/** A single-button admin action with optional native confirmation and visible result. */
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "secondary",
  confirmText,
}: {
  action: Action;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  confirmText?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {pending ? (pendingLabel ?? "Procesando…") : label}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Issues a single-use PIN link and shows it exactly once, with honest delivery wording. */
export function TokenIssuer({
  action,
  label,
  confirmText,
  contacts,
  barrelNumber,
  variant = "primary",
}: {
  action: Action;
  label: string;
  confirmText?: string;
  contacts: { name: string; phone: string | null }[];
  barrelNumber: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const text = (name: string) =>
    state.activationUrl
      ? `Hola ${name}, este es el enlace para configurar el PIN compartido de la barrica ${barrelNumber} de Cinco Sentidos (válido hasta el ${new Date(state.expiresAt!).toLocaleString("es-AR")}, de un solo uso): ${state.activationUrl}`
      : "";
  return (
    <div className="flex flex-col gap-3">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (confirmText && !confirm(confirmText)) e.preventDefault();
        }}
      >
        <Button type="submit" variant={variant} size="sm" disabled={pending}>
          {pending ? "Generando…" : label}
        </Button>
      </form>
      {state.error && <Feedback state={state} />}
      {state.activationUrl && (
        <div className="border border-line-strong bg-surface-2 p-4 flex flex-col gap-3" role="status">
          <p className="text-sm font-medium">
            {state.purpose === "reset" ? "PIN anterior invalidado. Enlace para elegir el PIN nuevo:" : "Enlace para configurar el PIN:"}
          </p>
          <code className="block text-xs break-all bg-bg-alt px-2 py-2 select-all">{state.activationUrl}</code>
          <p className="text-xs text-ink-soft">
            Vence el {new Date(state.expiresAt!).toLocaleString("es-AR")} y sirve una sola vez. Se muestra solo ahora: si lo perdés, generá uno nuevo (el anterior queda sin efecto).
            El PIN es de la barrica: quien lo configure lo comparte con los demás dueños. <strong>Nada se envió automáticamente</strong> — copialo y entregalo por un canal de confianza.
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={state.activationUrl} label="Copiar enlace" />
            {contacts
              .filter((c) => (c.phone ?? "").replace(/\D/g, ""))
              .map((c) => (
                <a
                  key={c.name}
                  href={`https://wa.me/${(c.phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text(c.name))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center border border-ink/40 px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.14em] hover:border-ink hover:bg-surface transition-colors"
                >
                  WhatsApp a {c.name}
                </a>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CreateOwnerForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre" htmlFor="name">
        <Input id="name" name="name" required minLength={2} maxLength={80} autoComplete="off" />
      </Field>
      <Field label="Teléfono (WhatsApp)" htmlFor="phone" hint="Con código de país, ej. 5492614000000">
        <Input id="phone" name="phone" inputMode="tel" autoComplete="off" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="off" />
      </Field>
      <div className="sm:col-span-2 flex flex-col gap-2">
        <Feedback state={state} />
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear dueño"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ContactForm({ action, owner }: { action: Action; owner: { name: string; email: string | null; phone: string | null } }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3">
      <Field label="Nombre" htmlFor="c-name">
        <Input id="c-name" name="name" defaultValue={owner.name} required minLength={2} maxLength={80} />
      </Field>
      <Field label="Teléfono" htmlFor="c-phone">
        <Input id="c-phone" name="phone" defaultValue={owner.phone ?? ""} inputMode="tel" />
      </Field>
      <Field label="Email" htmlFor="c-email">
        <Input id="c-email" name="email" type="email" defaultValue={owner.email ?? ""} />
      </Field>
      <div className="sm:col-span-3 flex flex-col gap-2">
        <Feedback state={state} />
        <div>
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? "Guardando…" : "Guardar datos"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Allocation + permissions for one owner on one barrel. */
export function AssignmentForm({
  action,
  values,
  gifted,
}: {
  action: Action;
  values: { allocation: number; canEditStory: boolean; canGift: boolean };
  gifted: number;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        const form = e.currentTarget;
        const changedPerms =
          (form.elements.namedItem("canEditStory") as HTMLInputElement).checked !== values.canEditStory ||
          (form.elements.namedItem("canGift") as HTMLInputElement).checked !== values.canGift;
        if (changedPerms && !confirm("Cambiar permisos cierra las sesiones abiertas de esta barrica. ¿Continuar?")) e.preventDefault();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.65rem] uppercase tracking-[0.16em] text-ink-faint font-[family-name:var(--font-archivo)]">
          Botellas asignadas
          <Input name="allocation" type="number" min={gifted} step={1} defaultValue={values.allocation} className="w-28" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="canEditStory" defaultChecked={values.canEditStory} /> Historia
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="canGift" defaultChecked={values.canGift} /> Dedicar
        </label>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Select one option (an owner or a barrel) plus an optional initial allocation. */
export function AddForm({
  action,
  fieldName,
  label,
  options,
  submitLabel,
  confirmText,
}: {
  action: Action;
  fieldName: "ownerId" | "barrelId";
  label: string;
  options: { id: string; label: string }[];
  submitLabel: string;
  confirmText?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
    >
      <Field label={label} htmlFor={`add-${fieldName}`}>
        <select id={`add-${fieldName}`} name={fieldName} required defaultValue="" className="w-full border border-line-strong bg-surface-2 px-3 py-2 text-[0.95rem]">
          <option value="" disabled>
            Elegir…
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Botellas asignadas (opcional)" htmlFor={`add-alloc-${fieldName}`} hint="Se puede cambiar después. No puede superar las botellas sin asignar.">
        <Input id={`add-alloc-${fieldName}`} name="allocation" type="number" min={0} step={1} defaultValue={0} className="w-32" />
      </Field>
      <Feedback state={state} />
      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Agregando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
