"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  Activity, AlertTriangle, Building2, Euro, Phone, Search, Users,
} from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, ErrorState, Field, Input, Loading, Modal,
  PageHeader, Pager, Select, Stat, Table, Tabs, Td, Th, Textarea,
} from "@/components/voice/ui";
import { VOICE_PLANS, getVoicePlan } from "@/lib/voice/plans";
import { formatDate } from "@/lib/utils";

type Overview = {
  businesses: { total: number; active: number; suspended: number };
  users: number;
  calls: { total: number; last30Days: number };
  leads: number;
  appointments: number;
  subscriptions: { planId: string; status: string; _count: { _all: number } }[];
  mrr: number;
  usageThisPeriod: Record<string, number>;
  health: { failedNotifications: number; newDemoRequests: number };
};

type BusinessRow = {
  id: string; name: string; slug: string; status: string; industry: string;
  createdAt: string; isDemo: boolean;
  subscription: { planId: string; status: string; minutesOverride: number | null } | null;
  _count: { calls: number; leads: number; memberships: number; phoneNumbers: number };
  memberships: { user: { email: string; name: string | null } }[];
};

type DemoRequest = {
  id: string; name: string; businessName: string; email: string; phone: string | null;
  industry: string | null; message: string | null; status: string; createdAt: string;
};

export default function AdminPage() {
  const [tab, setTab] = useState("overview");

  return (
    <>
      <PageHeader
        title="SlamAI admin"
        description="The platform view. Only SlamAI staff can reach this page."
      />
      <Tabs
        tabs={[
          { key: "overview", label: "Overview", icon: <Activity className="h-3.5 w-3.5" /> },
          { key: "businesses", label: "Workspaces", icon: <Building2 className="h-3.5 w-3.5" /> },
          { key: "demo", label: "Demo requests", icon: <Users className="h-3.5 w-3.5" /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "overview" && <OverviewTab />}
      {tab === "businesses" && <BusinessesTab />}
      {tab === "demo" && <DemoTab />}
    </>
  );
}

function OverviewTab() {
  const { data, loading, error, refresh } = useApi<Overview>("/api/admin/overview");

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Monthly recurring revenue"
          value={`€${data.mrr.toLocaleString()}`}
          icon={<Euro className="h-5 w-5" />}
          tone="success"
          sub="From active and trialing plans"
        />
        <Stat
          label="Workspaces"
          value={data.businesses.total}
          icon={<Building2 className="h-5 w-5" />}
          sub={`${data.businesses.active} active · ${data.businesses.suspended} suspended`}
        />
        <Stat label="Users" value={data.users} icon={<Users className="h-5 w-5" />} tone="info" />
        <Stat
          label="Calls (30 days)"
          value={data.calls.last30Days.toLocaleString()}
          icon={<Phone className="h-5 w-5" />}
          tone="brand"
          sub={`${data.calls.total.toLocaleString()} all time`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Subscriptions by plan" />
          <div className="divide-y divide-white/[0.04]">
            {data.subscriptions.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-slate-500">No subscriptions yet.</p>
            ) : (
              data.subscriptions.map((row, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 text-[13px]">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-slate-200">{getVoicePlan(row.planId).name}</span>
                    <Badge tone={row.status === "active" ? "success" : row.status === "trialing" ? "brand" : "warning"}>
                      {row.status}
                    </Badge>
                  </span>
                  <span className="font-medium text-slate-200">{row._count._all}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Platform usage this period" />
          <div className="divide-y divide-white/[0.04]">
            {Object.entries(data.usageThisPeriod).map(([metric, value]) => (
              <div key={metric} className="flex items-center justify-between px-5 py-3 text-[13px]">
                <span className="capitalize text-slate-400">{metric.replace(/_/g, " ")}</span>
                <span className="font-medium text-slate-200">{Math.round(value).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Health" />
        <div className="grid gap-px bg-white/[0.05] sm:grid-cols-3">
          <HealthTile label="Failed notifications (30d)" value={data.health.failedNotifications} warn={data.health.failedNotifications > 0} />
          <HealthTile label="New demo requests" value={data.health.newDemoRequests} warn={data.health.newDemoRequests > 0} />
          <HealthTile label="Suspended workspaces" value={data.businesses.suspended} warn={data.businesses.suspended > 0} />
        </div>
      </Card>
    </>
  );
}

function HealthTile({ label, value, warn }: { label: string; value: number; warn: boolean }) {
  return (
    <div className="bg-[#15152b] px-5 py-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {warn && <AlertTriangle className="h-3 w-3 text-amber-400" />}
        {label}
      </div>
      <div className={`mt-1.5 text-xl font-semibold ${warn ? "text-amber-300" : "text-white"}`}>{value}</div>
    </div>
  );
}

function BusinessesTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<BusinessRow | null>(null);

  const { data, loading, error, refresh } = useApi<{
    items: BusinessRow[]; page: number; pageCount: number; total: number;
  }>(`/api/admin/businesses?page=${page}&status=${status}${query ? `&q=${encodeURIComponent(query)}` : ""}`);

  return (
    <>
      <Card className="mb-4 p-3">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}
        >
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, slug or email" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
        </form>
      </Card>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Workspace</Th>
                <Th>Owner</Th>
                <Th>Plan</Th>
                <Th>Activity</Th>
                <Th>Joined</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((business) => (
                <tr key={business.id} className="transition-colors hover:bg-white/[0.02]">
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{business.name}</span>
                      {business.isDemo && <Badge tone="warning">Demo</Badge>}
                      {business.status === "suspended" && <Badge tone="danger">Suspended</Badge>}
                    </div>
                    <div className="text-[12px] text-slate-500">{business.slug}</div>
                  </Td>
                  <Td className="text-[13px] text-slate-400">
                    {business.memberships[0]?.user.email ?? "—"}
                  </Td>
                  <Td>
                    <Badge tone={business.subscription?.status === "active" ? "success" : "neutral"}>
                      {getVoicePlan(business.subscription?.planId).name}
                    </Badge>
                  </Td>
                  <Td className="text-[13px] text-slate-400">
                    {business._count.calls} calls · {business._count.leads} leads
                  </Td>
                  <Td className="whitespace-nowrap text-[13px] text-slate-400">{formatDate(business.createdAt)}</Td>
                  <Td className="text-right">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(business)}>Manage</Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {data && <Pager page={data.page} pageCount={data.pageCount} onChange={setPage} />}
        </Card>
      )}

      <ManageModal business={editing} onClose={() => setEditing(null)} onSaved={() => { refresh(); setEditing(null); }} />
    </>
  );
}

function ManageModal({
  business,
  onClose,
  onSaved,
}: {
  business: BusinessRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState("");
  const [minutes, setMinutes] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  if (!business) return null;

  if (key !== business.id) {
    setKey(business.id);
    setPlanId(business.subscription?.planId ?? "trial");
    setMinutes(business.subscription?.minutesOverride ? String(business.subscription.minutesOverride) : "");
    setReason("");
  }

  async function update(payload: Record<string, unknown>) {
    if (!business) return;
    setSaving(true);
    try {
      await api(`/api/admin/businesses/${business.id}`, "PATCH", payload);
      toast.success("Updated");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const suspended = business.status === "suspended";

  return (
    <Modal open onClose={onClose} title={business.name} description={`${business._count.memberships} members · ${business._count.phoneNumbers} numbers`}>
      <div className="space-y-4">
        <Field label="Plan" hint="Changes what this workspace can use. It does not touch Stripe.">
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {VOICE_PLANS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Included minutes override" hint="Leave blank to use the plan's own allowance.">
          <Input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="e.g. 5000" />
        </Field>

        <Button
          loading={saving}
          onClick={() => update({ planId, minutesOverride: minutes.trim() === "" ? null : Number(minutes) })}
        >
          Save plan changes
        </Button>

        <div className="border-t border-white/[0.06] pt-4">
          {suspended ? (
            <>
              <p className="mb-3 text-[13px] text-slate-400">
                This workspace is suspended. Its AI is not answering calls.
              </p>
              <Button variant="secondary" loading={saving} onClick={() => update({ status: "active" })}>
                Reactivate workspace
              </Button>
            </>
          ) : (
            <>
              <Field label="Reason for suspending" hint="Shown to the customer in their dashboard.">
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Non-payment after three reminders" />
              </Field>
              <Button
                variant="danger"
                className="mt-3"
                loading={saving}
                onClick={() => update({ status: "suspended", suspendReason: reason })}
              >
                Suspend workspace
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DemoTab() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useApi<{
    items: DemoRequest[]; page: number; pageCount: number;
  }>(`/api/admin/demo-requests?page=${page}`);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  async function setStatus(id: string, status: string) {
    try {
      await api("/api/admin/demo-requests", "PATCH", { id, status });
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader title="Demo requests" description="SlamAI's own inbound pipeline." />
      <Table>
        <thead>
          <tr>
            <Th>Who</Th>
            <Th>Business</Th>
            <Th>Contact</Th>
            <Th>Message</Th>
            <Th>Status</Th>
            <Th>When</Th>
          </tr>
        </thead>
        <tbody>
          {(data?.items ?? []).map((request) => (
            <tr key={request.id} className="transition-colors hover:bg-white/[0.02]">
              <Td className="font-medium text-slate-200">{request.name}</Td>
              <Td className="text-[13px] text-slate-300">
                {request.businessName}
                {request.industry && <div className="text-[12px] text-slate-500">{request.industry}</div>}
              </Td>
              <Td className="text-[13px] text-slate-400">
                <div>{request.email}</div>
                {request.phone && <div className="text-slate-500">{request.phone}</div>}
              </Td>
              <Td className="max-w-[240px]">
                <span className="line-clamp-2 text-[12.5px] text-slate-400">{request.message ?? "—"}</span>
              </Td>
              <Td>
                <Select
                  value={request.status}
                  onChange={(e) => setStatus(request.id, e.target.value)}
                  className="w-auto py-1.5 text-[13px]"
                  aria-label={`Status for ${request.email}`}
                >
                  {["new", "contacted", "booked", "won", "lost"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </Td>
              <Td className="whitespace-nowrap text-[13px] text-slate-400">{formatDate(request.createdAt)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {data && <Pager page={data.page} pageCount={data.pageCount} onChange={setPage} />}
      {data?.items.length === 0 && (
        <p className="px-5 py-10 text-center text-[13px] text-slate-500">No demo requests yet.</p>
      )}
    </Card>
  );
}
