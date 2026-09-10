import { permanentRedirect } from "next/navigation";

/**
 * There is one sign-in page for the whole platform, at /login. It routes to
 * the right product after sign-in, so a customer never has to know which
 * front door they came through.
 */
export default function LoginRedirect() {
  permanentRedirect("/login");
}
