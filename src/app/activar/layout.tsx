import "../wine/wine.css";

export const metadata = { title: "Activar acceso — Cinco Sentidos", robots: { index: false, follow: false } };

export default function ActivarLayout({ children }: { children: React.ReactNode }) {
  return <div className="cs-scope min-h-dvh">{children}</div>;
}
