import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getActor } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getActor()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(195,154,69,0.12),transparent_60%)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card card-pad">
          <h1 className="text-lg font-semibold text-ink-100">Quality Command Centre</h1>
          <p className="mb-5 mt-1 text-sm text-ink-300">Sign in with your ASGARD quality account.</p>
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-[11px] tracking-[0.2em] text-ink-400">INSPECT · ASSURE · BUILD BETTER</p>
      </div>
    </main>
  );
}
