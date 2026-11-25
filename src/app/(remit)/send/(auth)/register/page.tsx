import type { Metadata } from "next";
import { RegisterForm } from "@/components/remit/RegisterForm";

export const metadata: Metadata = { title: "Create your account" };

export default function SendRegisterPage() {
  return <RegisterForm />;
}
