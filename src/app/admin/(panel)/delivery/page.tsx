import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { adminZones, globalBlackouts } from "@/server/services/admin-ops";
import { formatDeliveryDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { BoundForm } from "@/components/admin/bound-form";
import { SubmitButton, TextInput } from "@/components/admin/form";
import { Badge, Empty, PageHeader, Panel, Table } from "@/components/admin/ui";
import { ZoneForm } from "@/components/admin/zone-form";
import { addBlackoutAction, removeBlackoutAction, saveZoneAction } from "../../_actions/ops";

export const metadata: Metadata = { title: "Delivery areas" };

export default async function DeliveryAdminPage() {
  const db = getDb();
  const [zones, closed] = await Promise.all([adminZones(db), globalBlackouts(db)]);
  return (
    <>
      <PageHeader title="Delivery areas" description="Customers can order only for PIN codes in an active area. Add areas as you expand." />
      {zones.length ? (
        <Table>
          <thead>
            <tr>
              <th>Area</th>
              <th>PIN codes</th>
              <th>Charge</th>
              <th>Slots</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {zones.map(({ zone, pincodes, slots }) => (
              <tr key={zone.id}>
                <td>
                  <Link href={`/admin/delivery/${zone.id}`} className="font-semibold text-saffron-dark hover:underline">
                    {zone.name}
                  </Link>
                </td>
                <td className="text-sm">{pincodes.map((p) => p.pincode).join(", ") || <span className="text-danger">None</span>}</td>
                <td className="text-sm">
                  {formatINR(zone.deliveryFeePaise)}
                  {zone.freeDeliveryAbovePaise ? <span className="block text-xs text-muted">free from {formatINR(zone.freeDeliveryAbovePaise)}</span> : null}
                </td>
                <td className="text-sm">{slots.filter((s) => s.isActive).length || "Any time"}</td>
                <td>{zone.isActive ? <Badge tone="good">Active</Badge> : <Badge tone="warn">Off</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>No delivery areas yet.</Empty>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Add a delivery area">
          <ZoneForm id="new" action={saveZoneAction} values={{ name: "", slug: "", isActive: false, deliveryFeePaise: 0, minOrderPaise: 0, freeDeliveryAbovePaise: null, minLeadDays: 1, maxAdvanceDays: 14, sameDayEnabled: false, sameDayCutoff: null, instructions: "", landingPublished: false, landingTitle: "", landingContent: "", sortOrder: zones.length * 10, pincodes: "" }} />
        </Panel>
        <Panel title="Dates closed in every area" description="For festivals or holidays when you do not deliver.">
          <BoundForm action={addBlackoutAction} id="all" className="mb-4 grid grid-cols-[1fr_1fr_auto] items-end gap-2" resetOnSuccess>
            <TextInput name="date" label="Date" type="date" />
            <TextInput name="reason" label="Reason" />
            <SubmitButton variant="secondary">Close</SubmitButton>
          </BoundForm>
          {closed.length ? (
            <ul className="divide-y divide-line text-sm">
              {closed.map((b) => (
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
          ) : (
            <p className="text-sm text-muted">No closed dates.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
