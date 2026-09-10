import { redirect } from "next/navigation";

/** The workspace switcher lives in the sidebar; this keeps the URL working. */
export default function WorkspacesRedirect() {
  redirect("/voice/new-workspace");
}
