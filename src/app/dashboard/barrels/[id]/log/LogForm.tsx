"use client";

import { useState } from "react";
import { logOperation } from "@/lib/actions/operations";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

interface OperationTypeOpt {
  id: string;
  name: string;
  defaultCustomerVisible: boolean;
  description: string | null;
  systemKey: string | null;
}
interface BarrelOpt {
  id: string;
  number: string;
}
interface StageOpt {
  id: string;
  name: string;
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function LogForm({
  projectId,
  barrels,
  stages,
  operationTypes,
  suggestedByBarrel,
  defaultBarrelId,
  defaultStageId,
}: {
  projectId: string;
  barrels: BarrelOpt[];
  stages: StageOpt[];
  operationTypes: OperationTypeOpt[];
  suggestedByBarrel: Record<string, string | null>;
  defaultBarrelId?: string;
  defaultStageId?: string;
}) {
  const [selectedType, setSelectedType] = useState<OperationTypeOpt | null>(null);
  const [customerVisible, setCustomerVisible] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [barrelId, setBarrelId] = useState(defaultBarrelId ?? "");
  const suggested = operationTypes.find((t) => t.id === suggestedByBarrel[barrelId]) ?? null;

  function pickType(t: OperationTypeOpt) {
    setSelectedType(t);
    setCustomerVisible(t.defaultCustomerVisible);
  }

  const isLab = selectedType?.systemKey === "lab";

  return (
    <form action={logOperation} className="flex flex-col gap-6">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="operationTypeId" value={selectedType?.id ?? ""} />

      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2 block">
          ¿Qué pasó?
        </span>
        {suggested && selectedType?.id !== suggested.id && (
          <button
            type="button"
            onClick={() => pickType(suggested)}
            className="w-full mb-2 rounded-lg border border-brass bg-brass-tint px-4 py-3 text-left text-sm text-brass-strong"
          >
            <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.14em]">
              Sugerida para esta barrica
            </span>
            <span className="font-medium">{suggested.name}</span>
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          {operationTypes.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => pickType(t)}
              className={`rounded-lg border px-4 py-3.5 text-left text-sm font-medium transition-colors ${
                selectedType?.id === t.id
                  ? "border-brass bg-brass-tint text-brass-strong"
                  : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Fecha" htmlFor="date">
          <Input id="date" name="date" type="date" defaultValue={today()} required />
        </Field>

        {barrels.length > 1 ? (
          <Field label="Barrica" htmlFor="barrelId">
            <Select id="barrelId" name="barrelId" value={barrelId} onChange={(e) => setBarrelId(e.target.value)}>
              {barrels.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.number}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="barrelId" value={defaultBarrelId ?? ""} />
        )}
      </div>

      {stages.length > 0 && (
        <Field label="Etapa" htmlFor="stageId">
          <Select id="stageId" name="stageId" defaultValue={defaultStageId}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {isLab && (
        <div className="rounded-lg border border-line bg-surface-2 p-4 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Análisis
          </span>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brix" htmlFor="brix">
              <Input id="brix" name="brix" type="number" step="0.1" inputMode="decimal" />
            </Field>
            <Field label="pH" htmlFor="ph">
              <Input id="ph" name="ph" type="number" step="0.01" inputMode="decimal" />
            </Field>
            <Field label="SO₂ total" htmlFor="totalSo2">
              <Input id="totalSo2" name="totalSo2" type="number" step="1" inputMode="decimal" />
            </Field>
            <Field label="Acidez volátil" htmlFor="volatileAcid">
              <Input id="volatileAcid" name="volatileAcid" type="number" step="0.01" inputMode="decimal" />
            </Field>
          </div>
          <Field label="Notas sensoriales (interno)" htmlFor="sensoryNotes">
            <Textarea id="sensoryNotes" name="sensoryNotes" rows={2} />
          </Field>
        </div>
      )}

      <Field label="Notas (opcional)" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} placeholder="Solo si hace falta." />
      </Field>

      <Field label="Foto (opcional)" htmlFor="photo">
        <Input id="photo" name="photo" type="file" accept="image/*" capture="environment" className="py-2" />
      </Field>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            name="featured"
            checked={featured}
            onChange={(e) => {
              setFeatured(e.target.checked);
              if (e.target.checked) setCustomerVisible(true);
            }}
            className="accent-brass"
          />
          ✨ Marcar como momento destacado
        </label>
        {featured && (
          <div className="flex flex-col gap-3 pl-6">
            <Field label="Título para el cliente" htmlFor="customerHeadline">
              <Input
                id="customerHeadline"
                name="customerHeadline"
                placeholder='Ej: "Hoy probamos tu vino"'
                maxLength={80}
              />
            </Field>
            <Field label="Nota breve para el cliente (opcional)" htmlFor="customerNote">
              <Textarea id="customerNote" name="customerNote" rows={2} maxLength={280} />
            </Field>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="customerVisible"
            checked={customerVisible}
            disabled={featured}
            onChange={(e) => setCustomerVisible(e.target.checked)}
            className="accent-brass"
          />
          Visible para el cliente en la página de su barrica
        </label>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          name="redirectMode"
          value="done"
          disabled={!selectedType}
          size="md"
          className="flex-1 py-3.5 text-base"
        >
          Guardar
        </Button>
        <Button
          type="submit"
          name="redirectMode"
          value="again"
          disabled={!selectedType}
          variant="secondary"
          size="md"
          className="flex-1 py-3.5 text-base"
        >
          Guardar y cargar otra
        </Button>
      </div>
    </form>
  );
}
