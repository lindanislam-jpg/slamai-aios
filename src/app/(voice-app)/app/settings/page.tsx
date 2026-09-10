"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell, Building2, Clock, Plug, ScrollText, Users, Wrench, Phone,
} from "lucide-react";
import { Loading, PageHeader, Tabs } from "@/components/voice/ui";
import BusinessSettings from "@/components/voice/settings/BusinessSettings";
import HoursSettings from "@/components/voice/settings/HoursSettings";
import ServicesSettings from "@/components/voice/settings/ServicesSettings";
import PhoneSettings from "@/components/voice/settings/PhoneSettings";
import TeamSettings from "@/components/voice/settings/TeamSettings";
import NotificationSettings from "@/components/voice/settings/NotificationSettings";
import IntegrationSettings from "@/components/voice/settings/IntegrationSettings";
import AuditSettings from "@/components/voice/settings/AuditSettings";

const TABS = [
  { key: "business", label: "Business", icon: <Building2 className="h-3.5 w-3.5" /> },
  { key: "hours", label: "Opening hours", icon: <Clock className="h-3.5 w-3.5" /> },
  { key: "services", label: "Services", icon: <Wrench className="h-3.5 w-3.5" /> },
  { key: "phone", label: "Phone numbers", icon: <Phone className="h-3.5 w-3.5" /> },
  { key: "team", label: "Team", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "notifications", label: "Notifications", icon: <Bell className="h-3.5 w-3.5" /> },
  { key: "integrations", label: "Integrations", icon: <Plug className="h-3.5 w-3.5" /> },
  { key: "audit", label: "Activity log", icon: <ScrollText className="h-3.5 w-3.5" /> },
];

function SettingsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("tab") ?? "business";

  return (
    <>
      <PageHeader title="Settings" description="Everything about how your workspace and your AI are set up." />
      <Tabs
        tabs={TABS}
        active={active}
        onChange={(key) => router.replace(`/app/settings?tab=${key}`, { scroll: false })}
      />
      {active === "business" && <BusinessSettings />}
      {active === "hours" && <HoursSettings />}
      {active === "services" && <ServicesSettings />}
      {active === "phone" && <PhoneSettings />}
      {active === "team" && <TeamSettings />}
      {active === "notifications" && <NotificationSettings />}
      {active === "integrations" && <IntegrationSettings />}
      {active === "audit" && <AuditSettings />}
    </>
  );
}

export default function SettingsPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<Loading />}>
      <SettingsContent />
    </Suspense>
  );
}
