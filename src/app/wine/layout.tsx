import "./wine.css";

/**
 * Public barrel experience. Serif display type is Georgia (system font);
 * labels and metadata use Archivo (font variable provided by the root layout). Tokens live in wine.css under .cs-scope.
 */
export default function WineLayout({ children }: { children: React.ReactNode }) {
  return <div className="cs-scope min-h-dvh">{children}</div>;
}
