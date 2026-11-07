import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-md">
        <Logo />
        <h1 className="mt-10 text-[26px]">This page doesn&rsquo;t exist</h1>
        <p className="mt-3 text-muted">The position may have closed, or the link may be mistyped.</p>
        <ButtonLink href="/" size="lg" className="mt-8">See open positions</ButtonLink>
      </div>
    </main>
  );
}
