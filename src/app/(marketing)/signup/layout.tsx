import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start free",
  description:
    "Create your AI receptionist in under ten minutes. Free for 14 days, no card required.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
