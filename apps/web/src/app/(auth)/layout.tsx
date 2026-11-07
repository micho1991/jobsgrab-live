import Link from "next/link";
import { Logo } from "@/components/logo";
import { JourneyTrack } from "@/components/journey-track";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Brand panel: full height on desktop, a slim band on mobile */}
      <aside className="bg-deep text-white">
        <div className="flex h-16 items-center px-6 lg:hidden"><Logo tone="light" /></div>
        <div className="sticky top-0 hidden h-dvh flex-col justify-between px-12 py-10 lg:flex xl:px-16">
          <Logo tone="light" />
          <div className="max-w-sm">
            <p className="text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-white">
              Apply once, then follow your application through every stage.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-steel-light">
              You&rsquo;ll see where you stand and get an email each time something changes.
            </p>
            <div className="mt-10"><JourneyTrack reached={4} /></div>
          </div>
          <p className="text-sm text-steel-light">
            Your data is handled under our <Link href="/privacy" className="underline underline-offset-2 hover:text-white">privacy policy</Link>.
          </p>
        </div>
      </aside>

      <main className="flex items-start justify-center px-5 py-10 sm:px-8 lg:items-center lg:py-16">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
