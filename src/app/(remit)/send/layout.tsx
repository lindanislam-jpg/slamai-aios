import type { Metadata } from "next";
import { brand, wordmark } from "@/remit/config/brand";

/**
 * Theme boundary for the money-transfer product.
 *
 * `data-app="send"` scopes the bright fintech theme in globals.css, so this
 * product can look nothing like the rest of the application without either
 * side having to know about the other.
 */

export const metadata: Metadata = {
  title: {
    default: `${wordmark()} — ${brand.tagline}`,
    template: `%s · ${wordmark()}`,
  },
  description:
    "Send money internationally with a flat transfer fee, the exchange rate shown up front, and tracking from payment to payout.",
};

export default function SendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="send" className="min-h-screen">
      {children}
    </div>
  );
}
