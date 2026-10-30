import { getBarrelAccess } from "@/lib/owner-session";
import { getSession } from "@/lib/session";
import { isStaff } from "@/lib/enums";
import { barrelIdsAllowedForUpload, isCoverName } from "@/lib/upload-access";
import { getStore } from "@/lib/storage";

// Serves uploaded images (strict filename pattern, no path traversal).
//  - cover-*  : the barrel cover shown on the PIN screen, public by design.
//  - the rest : private. Staff session, or a PIN session for a barrel of the
//               project the photo belongs to. Never cached by shared caches.
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const NOT_FOUND = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

async function mayViewPrivate(name: string): Promise<boolean> {
  const staff = await getSession();
  if (staff.userId && staff.role && isStaff(staff.role)) return true;
  for (const barrelId of await barrelIdsAllowedForUpload(name)) {
    if (await getBarrelAccess(barrelId)) return true;
  }
  return false;
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const match = /^[A-Za-z0-9-]{1,80}\.([A-Za-z0-9]{1,5})$/.exec(name);
  const type = match ? TYPES[match[1].toLowerCase()] : undefined;
  if (!match || !type) return NOT_FOUND();

  const isCover = isCoverName(name);
  // Same response for "missing" and "not allowed" so file names cannot be probed.
  if (!isCover && !(await mayViewPrivate(name))) return NOT_FOUND();

  try {
    const bytes = await getStore().get(name);
    if (!bytes) return NOT_FOUND();
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": type,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": isCover ? "public, max-age=31536000, immutable" : "private, no-store",
      },
    });
  } catch {
    return NOT_FOUND();
  }
}
