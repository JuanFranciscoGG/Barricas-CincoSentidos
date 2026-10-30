"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export type BarrelOption = {
  id: string;
  number: string;
  projectId: string;
  projectName: string;
  variety: string;
  customerName: string;
};

const MAX_RESULTS = 12;

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function BarrelSearch({
  barrels,
  initialQuery,
}: {
  barrels: BarrelOption[];
  initialQuery: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const terms = norm(value).split(/\s+/).filter(Boolean);
    const list = terms.length
      ? barrels.filter((b) => {
          const hay = norm(`${b.number} ${b.projectName} ${b.variety} ${b.customerName}`);
          return terms.every((t) => hay.includes(t));
        })
      : barrels;
    return list.slice(0, MAX_RESULTS);
  }, [barrels, value]);

  function select(b: BarrelOption) {
    setOpen(false);
    router.push(`/dashboard/barrels/${b.id}/log`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && active >= 0 && results[active]) {
      e.preventDefault();
      select(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <form
      action="/dashboard"
      className="flex gap-2 max-w-md"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <div ref={rootRef} className="relative flex-1">
        <Input
          name="q"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Número de barrica — ej. CS-024"
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="barrel-search-list"
          aria-autocomplete="list"
          className="text-base py-3"
        />
        {open && (
          <ul
            id="barrel-search-list"
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto border border-line-strong bg-surface shadow-lg"
          >
            {results.length === 0 && (
              <li className="px-4 py-3 text-sm text-ink-faint">Sin resultados.</li>
            )}
            {results.map((b, i) => (
              <li key={b.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(b)}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full text-left px-4 py-2.5 transition-colors ${
                    i === active ? "bg-brass-tint" : "hover:bg-brass-tint"
                  }`}
                >
                  <span className="font-mono text-sm font-semibold text-brass-strong">{b.number}</span>
                  <span className="block text-sm">
                    {b.projectName} <span className="text-ink-soft">· {b.customerName}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button type="submit">Buscar</Button>
    </form>
  );
}
