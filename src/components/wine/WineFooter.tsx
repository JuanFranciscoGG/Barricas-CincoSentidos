import Image from "next/image";

export function WineFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer style={{ background: "var(--cs-ink)", color: "#d8cfc0", padding: "56px clamp(20px,5vw,56px) 132px" }}>
      <Image src="/brand/hand-mark.png" alt="" width={20} height={20} />
      <div className="mt-3.5" style={{ fontSize: 18, color: "rgba(239,234,224,.8)" }}>Cinco Sentidos</div>
      <div className="cs-sans" style={{ marginTop: 5, fontSize: 9.5, letterSpacing: "0.18em" }}>
        AGRELO · LUJÁN DE CUYO · MENDOZA
      </div>
      <div className="mt-[18px] italic" style={{ fontSize: 15, color: "rgba(239,234,224,.42)" }}>
        Volvé el mes que viene: algo habrá cambiado.
      </div>
      {children}
    </footer>
  );
}
