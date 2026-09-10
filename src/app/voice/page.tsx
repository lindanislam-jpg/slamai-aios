import { permanentRedirect } from "next/navigation";

/** SlamAI Voice moved to the front door. Old links keep working. */
export default function VoiceRedirect() {
  permanentRedirect("/");
}
