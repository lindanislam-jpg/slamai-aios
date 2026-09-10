import { permanentRedirect } from "next/navigation";

export default function SignupRedirect() {
  permanentRedirect("/signup");
}
