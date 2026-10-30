import { notFound, redirect } from "next/navigation";
import { primaryBarrelId, barrelPath } from "@/lib/admin-routes";

/**
 * The Proyectos section no longer exists — everything lives under Barricas.
 * This only keeps old bookmarks/links working: /dashboard/projects/<projectId>/<rest>
 * redirects to the same page of that project's barrel.
 */
export default async function LegacyProjectsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path = [] } = await params;
  const [projectId, ...rest] = path;
  if (!projectId) redirect("/dashboard/barrels");

  const barrelId = await primaryBarrelId(projectId);
  if (!barrelId) notFound();

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const suffix = rest.length ? `/${rest.map(encodeURIComponent).join("/")}` : "";
  redirect(`${barrelPath(barrelId, suffix)}${qs.size ? `?${qs}` : ""}`);
}
