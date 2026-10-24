import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { gateway } from "@/server/payments";
import { getSettings } from "@/server/services/settings";
import { paiseToRupeesInput } from "@/lib/money";
import { AdminForm, Checkbox, SubmitButton, TextArea, TextInput } from "@/components/admin/form";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { Badge, PageHeader, Panel } from "@/components/admin/ui";
import { saveCheckoutAction } from "../../../_actions/content";

export const metadata: Metadata = { title: "Checkout and payments" };

export default async function CheckoutSettings() {
  const c = await getSettings(getDb(), "checkout");
  const env = getEnv();
  const gw = gateway();
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="/admin/settings/checkout" />
      <Panel title="Online payment gateway" className="mb-5" description="Payment keys are set as environment variables on the server, never in this panel. See docs/environment-variables.md.">
        <p className="text-sm">
          {gw ? (
            <>
              <Badge tone={gw.isTest ? "warn" : "good"}>{gw.name === "mock" ? "Built-in test gateway" : gw.isTest ? "Razorpay test mode" : "Razorpay live"}</Badge>{" "}
              {gw.isTest ? "No real money moves. Use this only for testing." : "Customers can pay with UPI, cards, net banking and wallets."}
            </>
          ) : (
            <>
              <Badge tone="bad">Not configured</Badge> {env.PAYMENT_GATEWAY === "mock" && env.APP_STAGE === "production" ? "The test gateway is disabled on the production site." : "Set PAYMENT_GATEWAY=razorpay and the Razorpay keys to accept online payments."}
            </>
          )}
        </p>
        {env.PAYMENT_GATEWAY === "razorpay" ? <p className="mt-2 text-sm text-muted">Webhook address for the Razorpay dashboard: {env.APP_URL}/api/payments/webhook/razorpay (events: payment.captured, payment.failed, refund.processed, refund.failed).</p> : null}
      </Panel>
      <AdminForm action={saveCheckoutAction} className="space-y-5">
        <Panel title="Taking orders">
          <div className="space-y-3">
            <Checkbox name="acceptingOrders" label="Accept new orders" defaultChecked={c.acceptingOrders} hint="Untick to pause ordering, for example during a supply shortage. The shop stays visible." />
            <TextInput name="pausedMessage" label="Message while paused" defaultValue={c.pausedMessage} />
          </div>
        </Panel>
        <Panel title="Payment methods">
          <div className="space-y-4">
            <Checkbox name="onlinePaymentsEnabled" label="Offer online payment" defaultChecked={c.onlinePaymentsEnabled} hint="Works only when a payment gateway is configured above." />
            <div className="rounded-2xl border border-line p-4">
              <Checkbox name="codEnabled" label="Offer Cash on Delivery" defaultChecked={c.codEnabled} hint="Off by default. Turn on only if your delivery staff can collect payment." />
              <TextInput name="codMaxOrder" label="Maximum order value for Cash on Delivery (₹, optional)" defaultValue={paiseToRupeesInput(c.codMaxOrderPaise)} inputMode="decimal" className="mt-3 max-w-xs" />
            </div>
            <TextInput name="paymentWindowMinutes" label="Minutes a customer has to complete online payment" defaultValue={String(c.paymentWindowMinutes)} inputMode="numeric" className="max-w-xs" hint="Unpaid orders are cancelled after this and their stock is released (10 to 180)." />
          </div>
        </Panel>
        <Panel title="Cart and stock">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="maxQuantityPerLine" label="Maximum quantity per item in one order" defaultValue={String(c.maxQuantityPerLine)} inputMode="numeric" hint="Larger requirements go through bulk enquiries." />
            <TextInput name="lowStockThreshold" label="Low stock warning at" defaultValue={String(c.lowStockThreshold)} inputMode="numeric" />
          </div>
          <TextArea name="checkoutNote" label="Note shown at checkout (optional)" defaultValue={c.checkoutNote} rows={2} className="mt-4" placeholder="e.g. Flowers are natural; colours may vary slightly." />
        </Panel>
        <SubmitButton>Save checkout settings</SubmitButton>
      </AdminForm>
    </>
  );
}
