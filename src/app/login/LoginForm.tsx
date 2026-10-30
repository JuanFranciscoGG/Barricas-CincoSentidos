"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

const initialState: LoginState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Usuario o email" htmlFor="email">
        <Input id="email" name="email" type="text" autoComplete="username" required />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error && (
        <p className="text-sm text-sev-high" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
