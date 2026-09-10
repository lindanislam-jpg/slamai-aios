"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Phone } from "lucide-react";
import { Button, Card, Loading } from "@/components/voice/ui";
import { api, errorMessage } from "@/lib/voice/client";

function AcceptInvite() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("");
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("That invitation link is incomplete. Ask whoever invited you to send it again.");
      return;
    }

    api<{ businessName: string }>("/api/v1/team/accept", "POST", { token })
      .then((result) => {
        setBusinessName(result.businessName);
        setState("done");
      })
      .catch((err) => {
        setState("error");
        setMessage(errorMessage(err));
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08081a] px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/voice" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Phone className="h-4 w-4 text-white" />
          </span>
          <span className="text-[16px] font-semibold text-white">SlamAI Voice</span>
        </Link>

        <Card className="p-8 text-center">
          {state === "working" && <Loading label="Checking your invitation…" />}

          {state === "done" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-6 w-6 text-emerald-400" />
              </div>
              <h1 className="mt-4 text-[20px] font-semibold text-white">You&apos;re in</h1>
              <p className="mt-2 text-[14px] text-slate-400">
                You now have access to <span className="text-slate-200">{businessName}</span>.
              </p>
              <Button className="mt-6" onClick={() => router.push("/app")}>
                Open the dashboard
              </Button>
            </>
          )}

          {state === "error" && (
            <>
              <h1 className="text-[20px] font-semibold text-white">We couldn&apos;t accept that invitation</h1>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{message}</p>
              <p className="mt-4 text-[13px] text-slate-500">
                If you weren&apos;t signed in, <Link href="/voice/login" className="text-indigo-400 hover:underline">sign in</Link>{" "}
                first and open the link again.
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<Loading />}>
      <AcceptInvite />
    </Suspense>
  );
}
