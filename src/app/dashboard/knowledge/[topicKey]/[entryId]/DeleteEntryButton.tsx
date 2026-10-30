"use client";

import { deleteKnowledgeEntry } from "@/lib/actions/knowledge";
import { Button } from "@/components/ui/Button";

export function DeleteEntryButton({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteKnowledgeEntry}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar definitivamente "${title}"? Esta acción no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger" size="sm">
        Eliminar entrada
      </Button>
    </form>
  );
}
