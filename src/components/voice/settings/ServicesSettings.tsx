"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, Wrench } from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Loading,
  Modal, Table, Td, Textarea, Th,
} from "../ui";

type Service = {
  id: string; name: string; description: string | null; price: number | null;
  priceNote: string | null; durationMin: number; isActive: boolean;
};

export default function ServicesSettings() {
  const { data, loading, error, refresh } = useApi<{ services: Service[] }>("/api/v1/services");
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);

  const services = data?.services ?? [];

  async function remove(id: string) {
    try {
      await api(`/api/v1/services/${id}`, "DELETE");
      toast.success("Removed");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <>
      {services.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title="No services yet"
          description="Add what you do and what it costs. These are the only prices your AI will ever quote — anything you leave blank, it will offer a callback for instead of guessing."
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Add a service</Button>}
        />
      ) : (
        <Card>
          <CardHeader
            title="Services"
            description="The only prices your AI is allowed to quote."
            action={<Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>Add</Button>}
          />
          <Table>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Price</Th>
                <Th>Length</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id} className="transition-colors hover:bg-white/[0.02]">
                  <Td>
                    <div className="font-medium text-slate-200">{service.name}</div>
                    {service.description && (
                      <div className="line-clamp-1 text-[12px] text-slate-500">{service.description}</div>
                    )}
                  </Td>
                  <Td className="text-[13px] text-slate-300">
                    {service.price !== null ? `€${service.price}` : (service.priceNote || "On enquiry")}
                  </Td>
                  <Td className="text-[13px] text-slate-400">{service.durationMin} min</Td>
                  <Td>
                    <Badge tone={service.isActive ? "success" : "neutral"}>
                      {service.isActive ? "Live" : "Hidden"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(service)}>Edit</Button>
                      <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => remove(service.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="border-t border-white/[0.06] px-5 py-3.5 text-[12.5px] leading-relaxed text-slate-500">
            Leave a price blank for anything you price on site. Your AI will say a colleague will confirm the cost
            rather than inventing a figure.
          </p>
        </Card>
      )}

      <ServiceModal
        service={editing}
        open={Boolean(editing) || creating}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={refresh}
      />
    </>
  );
}

function ServiceModal({
  service,
  open,
  onClose,
  onSaved,
}: {
  service: Service | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", description: "", price: "", priceNote: "", durationMin: "60" });
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  const currentKey = service?.id ?? "new";
  if (open && key !== currentKey) {
    setKey(currentKey);
    setForm({
      name: service?.name ?? "",
      description: service?.description ?? "",
      price: service?.price !== null && service?.price !== undefined ? String(service.price) : "",
      priceNote: service?.priceNote ?? "",
      durationMin: String(service?.durationMin ?? 60),
    });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        price: form.price.trim() === "" ? null : Number(form.price),
        priceNote: form.priceNote,
        durationMin: Number(form.durationMin) || 60,
        isActive: service?.isActive ?? true,
      };
      if (service) await api(`/api/v1/services/${service.id}`, "PATCH", payload);
      else await api("/api/v1/services", "POST", payload);

      toast.success("Saved");
      setKey(null);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { setKey(null); onClose(); }}
      title={service ? "Edit service" : "Add a service"}
      footer={
        <>
          <Button variant="secondary" onClick={() => { setKey(null); onClose(); }}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Service name" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Boiler repair" />
        </Field>
        <Field label="Description" hint="Your AI can read this out if a caller asks what's involved.">
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price (€)" hint="Leave blank for anything you price on site.">
            <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="120" />
          </Field>
          <Field label="How long" hint="Used when booking, so two jobs never overlap.">
            <Input type="number" min={5} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} />
          </Field>
        </div>
        <Field label="What to say instead of a price" hint="Only used when the price is blank.">
          <Input
            value={form.priceNote}
            onChange={(e) => setForm({ ...form, priceNote: e.target.value })}
            placeholder="From €80, confirmed after we've seen the job"
          />
        </Field>
      </div>
    </Modal>
  );
}
