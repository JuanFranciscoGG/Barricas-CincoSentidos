import QRCode from "qrcode";
import { Card, CardTitle } from "@/components/ui/Card";
import { CopyButton } from "@/components/CopyButton";

/**
 * The physical/digital bridge: a QR (and, physically, an NFC chip programmed
 * with the same URL) embedded in the barrel's duela, pointing at the
 * customer's permanent, unauthenticated wine page — see src/app/wine/[token].
 */
export async function DuelaCard({ url }: { url: string }) {
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });

  return (
    <Card>
      <CardTitle>Duela / NFC</CardTitle>
      <p className="text-sm text-ink-soft mb-4">
        Programá la etiqueta NFC de la duela con esta URL. El código QR es el respaldo si el
        teléfono no lee NFC.
      </p>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URI, not a static asset */}
        <img src={qrDataUrl} alt="Código QR del vino" width={120} height={120} className="rounded-md border border-line" />
        <div className="min-w-0 flex-1">
          <span className="text-xs uppercase tracking-wide text-ink-faint block mb-1">URL pública</span>
          <p className="text-sm font-mono break-all text-ink-soft mb-3">{url}</p>
          <div className="flex flex-wrap items-center gap-3">
            <CopyButton text={url} label="Copiar URL" />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brass-strong underline underline-offset-2"
            >
              Abrir página →
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}
