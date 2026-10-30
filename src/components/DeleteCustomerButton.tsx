"use client";

import { deleteCustomer } from "@/lib/actions/customers";
import { Button } from "@/components/ui/Button";

export function DeleteCustomerButton({
  id,
  name,
  projectCount,
}: {
  id: string;
  name: string;
  projectCount: number;
}) {
  const extra =
    projectCount > 0
      ? ` Se eliminarán también sus ${projectCount} ${projectCount === 1 ? "proyecto" : "proyectos"} con todos sus registros.`
      : "";
  return (
    <form
      action={deleteCustomer}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar definitivamente a "${name}"?${extra} Esta acción no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger" size="sm">
        Eliminar cliente
      </Button>
    </form>
  );
}
