import Link from "next/link";
import { brand } from "@/remit/config/brand";
import { Wordmark } from "@/components/remit/ui";

/** Focused, single-column shell for sign-in, registration and verification. */
export default function SendAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="send-hero flex min-h-screen flex-col">
      <header className="px-5 py-4">
        <Wordmark />
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-2 sm:items-center sm:pt-0">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>

      <footer className="px-5 pb-8 text-center text-[12px] text-send-muted">
        <Link href="/send/legal/terms" className="hover:text-send-primary">
          Terms
        </Link>
        <span className="mx-2">·</span>
        <Link href="/send/legal/privacy" className="hover:text-send-primary">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/send/help" className="hover:text-send-primary">
          Help
        </Link>
        <p className="mt-2">Sandbox environment. No real money can move. {brand.legalEntity}.</p>
      </footer>
    </div>
  );
}
