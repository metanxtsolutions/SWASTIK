import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { adminZones } from "@/server/services/admin-ops";
import { formatDeliveryDate, formatTime } from "@/lib/dates";
import { BoundForm } from "@/components/admin/bound-form";
import { Checkbox, SubmitButton, TextInput } from "@/components/admin/form";
import { Badge, PageHeader, Panel } from "@/components/admin/ui";
import { ZoneForm } from "@/components/admin/zone-form";
import { addBlackoutAction, deleteSlotAction, deleteZoneAction, removeBlackoutAction, saveSlotAction, saveZoneAction } from "../../../_actions/ops";

export const metadata: Metadata = { title: "Delivery area" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SlotFields({ slot }: { slot?: { id: string; label: string; startTime: string; endTime: string; cutoffMinutes: number; capacity: number | null; daysOfWeek: number[]; isActive: boolean; sortOrder: number } }) {
  return (
    <>
      {slot ? <input type="hidden" name="slotId" value={slot.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <TextInput name="label" label="Label (optional)" defaultValue={slot?.label ?? ""} placeholder="Morning, 6 to 8 am" className="sm:col-span-2" />
        <TextInput name="startTime" label="Starts" type="time" defaultValue={slot?.startTime.slice(0, 5) ?? ""} />
        <TextInput name="endTime" label="Ends" type="time" defaultValue={slot?.endTime.slice(0, 5) ?? ""} />
        <TextInput name="cutoffHours" label="Close booking (hours before)" defaultValue={String((slot?.cutoffMinutes ?? 600) / 60)} inputMode="decimal" />
        <TextInput name="capacity" label="Max orders per day (optional)" defaultValue={slot?.capacity ? String(slot.capacity) : ""} inputMode="numeric" />
        <TextInput name="sortOrder" label="Sort order" defaultValue={String(slot?.sortOrder ?? 0)} inputMode="numeric" />
      </div>
      <fieldset className="mt-3">
        <legend className="field-label">Days</legend>
        <div className="flex flex-wrap gap-4">
          {DAYS.map((d, i) => (
            <Checkbox key={d} name="daysOfWeek" value={String(i)} label={d} defaultChecked={slot ? slot.daysOfWeek.includes(i) : true} />
          ))}
        </div>
      </fieldset>
      <div className="mt-3">
        <Checkbox name="isActive" label="Slot is open for booking" defaultChecked={slot?.isActive ?? true} />
      </div>
    </>
  );
}

export default async function ZonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const all = await adminZones(getDb());
  const found = all.find((z) => z.zone.id === id);
  if (!found) notFound();
  const { zone, pincodes, slots, blackouts } = found;
  return (
    <>
      <PageHeader back={{ href: "/admin/delivery", label: "Delivery areas" }} title={zone.name} description={zone.isActive ? <Badge tone="good">Active</Badge> : <Badge tone="warn">Not taking orders</Badge>} />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Area settings">
          <ZoneForm id={zone.id} action={saveZoneAction} values={{ ...zone, pincodes: pincodes.map((p) => (p.localities ? `${p.pincode}, ${p.localities}` : p.pincode)).join("\n") }} />
        </Panel>
        <div className="space-y-6">
          <Panel title="Delivery time slots" description="Without slots, customers pick only a date. Booking for a slot closes the set number of hours before it starts.">
            <ul className="space-y-3">
              {slots.map((s) => (
                <li key={s.id}>
                  <details className="rounded-2xl border border-line p-3">
                    <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold">
                      <span>
                        {s.label || `${formatTime(s.startTime)} to ${formatTime(s.endTime)}`} {!s.isActive ? <Badge>closed</Badge> : null}
                      </span>
                      <span className="text-xs font-normal text-muted">{s.daysOfWeek.length === 7 ? "Every day" : s.daysOfWeek.map((d) => DAYS[d]).join(", ")}</span>
                    </summary>
                    <BoundForm action={saveSlotAction} id={zone.id} className="mt-3">
                      <SlotFields slot={s} />
                      <div className="mt-3">
                        <SubmitButton variant="secondary" className="btn-sm">
                          Save slot
                        </SubmitButton>
                      </div>
                    </BoundForm>
                    <BoundForm action={deleteSlotAction} id={zone.id} className="mt-2">
                      <input type="hidden" name="slotId" value={s.id} />
                      <SubmitButton variant="secondary" className="btn-sm" confirm="Remove this slot?">
                        Remove slot
                      </SubmitButton>
                    </BoundForm>
                  </details>
                </li>
              ))}
            </ul>
            <details className="mt-3 rounded-2xl border border-dashed border-line p-3" open={!slots.length}>
              <summary className="cursor-pointer text-sm font-semibold text-saffron-dark">Add a time slot</summary>
              <BoundForm action={saveSlotAction} id={zone.id} className="mt-3" resetOnSuccess>
                <SlotFields />
                <div className="mt-3">
                  <SubmitButton className="btn-sm">Add slot</SubmitButton>
                </div>
              </BoundForm>
            </details>
          </Panel>
          <Panel title="Dates closed in this area">
            <BoundForm action={addBlackoutAction} id={zone.id} className="mb-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2" resetOnSuccess>
              <TextInput name="date" label="Date" type="date" />
              <TextInput name="reason" label="Reason" />
              <SubmitButton variant="secondary">Close</SubmitButton>
            </BoundForm>
            <ul className="divide-y divide-line text-sm">
              {blackouts.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2">
                  <span>
                    {formatDeliveryDate(b.date, { withYear: true })} {b.reason ? <span className="text-muted">({b.reason})</span> : null}
                  </span>
                  <BoundForm action={removeBlackoutAction} id={b.id}>
                    <input type="hidden" name="blackoutId" value={b.id} />
                    <SubmitButton variant="secondary" className="btn-sm">
                      Reopen
                    </SubmitButton>
                  </BoundForm>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Delete area" description="Areas with open orders cannot be deleted. Turn the area off instead.">
            <BoundForm action={deleteZoneAction} id={zone.id}>
              <SubmitButton variant="danger" className="btn-sm" confirm="Delete this delivery area?">
                Delete area
              </SubmitButton>
            </BoundForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
