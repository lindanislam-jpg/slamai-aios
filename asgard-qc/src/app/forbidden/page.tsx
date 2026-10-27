import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card card-pad max-w-md text-center">
        <h1 className="text-lg font-semibold text-ink-100">Not authorised</h1>
        <p className="mt-2 text-sm text-ink-300">Your role does not include access to this area. Ask a Quality Manager or administrator if you need it.</p>
        <Link href="/" className="btn-secondary mt-5">Back to overview</Link>
      </div>
    </main>
  );
}
