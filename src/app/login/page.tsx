import Image from "next/image";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="dash min-h-dvh grid md:grid-cols-2">
      <div className="relative hidden md:block">
        <Image
          src="/brand/cellar-barrel.jpg"
          alt="Barrica en la cava de Cinco Sentidos"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1614]/70 via-transparent to-[#1a1614]/25" />
        <div className="absolute left-8 bottom-8 right-8 text-[#f3ebe0]">
          <div className="text-[0.65rem] uppercase tracking-[0.24em] font-[family-name:var(--font-archivo)] text-[#d9cba6]">Cinco Sentidos</div>
          <div className="mt-3 text-5xl leading-none tracking-tight">Barricas</div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Image src="/brand/hand-mark.png" alt="" width={40} height={40} className="mb-6" />
          <h1 className="text-4xl font-normal tracking-tight mb-2">Barricas</h1>
          <p className="text-ink-soft mb-8 text-sm">
            Cinco Sentidos — acceso interno para el equipo de bodega.
          </p>
          <LoginForm next={next ?? ""} />
        </div>
      </div>
    </div>
  );
}
