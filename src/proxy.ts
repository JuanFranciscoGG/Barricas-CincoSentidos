import { NextResponse, type NextRequest } from "next/server";

const OWNER_COOKIE = "barricas_owner";

/**
 * Client portal (/wine/*): the private PIN session must not survive a page
 * reload. A browser reload / address-bar visit is a full DOCUMENT request; the
 * app's own in-page updates (router.refresh after unlocking, server actions)
 * carry RSC / Next-Action headers. So on a document request we drop the PIN
 * session cookie — from the request the page sees (so the server renders the
 * PIN screen) and from the browser — and the PIN has to be entered again.
 * The session still works for everything done inside the already-loaded page.
 */
function isDocumentRequest(request: NextRequest) {
  if (request.method !== "GET") return false;
  const h = request.headers;
  if (h.has("rsc") || h.has("next-action") || h.has("next-router-prefetch")) return false;
  const dest = h.get("sec-fetch-dest");
  if (dest) return dest === "document" || dest === "iframe";
  return (h.get("accept") ?? "").includes("text/html");
}

function wineProxy(request: NextRequest) {
  if (!isDocumentRequest(request) || !request.cookies.has(OWNER_COOKIE)) return NextResponse.next();

  const headers = new Headers(request.headers);
  const rest = request.cookies
    .getAll()
    .filter((c) => c.name !== OWNER_COOKIE)
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (rest) headers.set("cookie", rest);
  else headers.delete("cookie");

  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(OWNER_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return response;
}

// Coarse gate only: is there a session cookie at all. The real check — is it
// valid, and does this role belong on this route — happens server-side in
// each route group's layout, where we can safely unseal it and hit Prisma.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/wine/")) return wineProxy(request);

  const hasSession = request.cookies.has("barricas_session");

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/wine/:path*"],
};
