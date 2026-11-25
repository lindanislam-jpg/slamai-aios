import Link from "next/link";
import type { Metadata } from "next";
import { runPreflight } from "@/remit/server/preflight-service";
import { SetupRequired } from "@/components/remit/SetupRequired";
import { Wordmark } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Setup" };

/**
 * Deployment setup status.
 *
 * A real page rather than an inline banner, so it can be linked to and so it
 * renders identically whether the database is up or not. When everything is
 * configured it says so instead of showing an empty error.
 */
export default async function SendSetupPage() {
  const report = await runPreflight();

  return (
    <div className="flex min-h-screen flex-col bg-send-canvas">
      <header className="border-b border-send-line bg-white">
        <div className="mx-auto max-w-3xl px-5 py-3.5">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <SetupRequired checks={report.checks} />

        {report.ok && (
          <p className="mt-5 text-center text-[14px] text-send-body">
            <Link href="/send" className="font-semibold text-send-primary hover:underline">
              Go to the app →
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
