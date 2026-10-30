import { Card } from "@/components/ui/Card";

export function AuditTable({
  rows,
}: {
  rows: { id: string; createdAt: Date; actorType: string; actorName: string | null; action: string; targetType: string | null; targetId: string | null }[];
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-3 font-medium">Fecha</th>
              <th className="px-5 py-3 font-medium">Quién</th>
              <th className="px-5 py-3 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-ink-faint">
                  Sin actividad registrada.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-2.5 text-ink-faint whitespace-nowrap">{r.createdAt.toLocaleString("es-AR")}</td>
                <td className="px-5 py-2.5">{r.actorType === "staff" ? (r.actorName ?? "Equipo") : r.actorType === "owner" ? "Dueño" : "Sistema"}</td>
                <td className="px-5 py-2.5 font-mono text-xs">{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
