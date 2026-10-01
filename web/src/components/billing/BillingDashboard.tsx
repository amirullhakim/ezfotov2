"use client"

import { useEffect, useRef, useState } from "react"
import { Check, CreditCard, Globe2, HardDrive, Loader2, RefreshCw } from "lucide-react"

import DashboardPage, {
  dashboardButtonClass,
  dashboardPrimaryButtonClass,
  dashboardCardClass,
  formatDashboardMoney,
} from "@/components/dashboard/DashboardPage"
import { apiFetch } from "@/lib/api"
import SubscriptionPaymentHistory from "@/components/billing/SubscriptionPaymentHistory"

type ServiceCode = "WEBSITE" | "CLIENT_GALLERY" | "EVENT_SALES"
type Terms = {
  currency: string
  price_cents: number
  billing_interval_months: number
  commission_bps: number
  customer_service_fee_cents: number
  storage_limit_bytes: number | null
  active_event_limit: number | null
  includes_website: boolean
}
type Plan = Terms & {
  id: string
  code: string
  name: string
  service_code: ServiceCode
  service_name: string
}
type Subscription = Terms & {
  id: string
  service_code: ServiceCode
  plan_id: string
  plan_code: string
  plan_name: string
  stored_status: string
  effective_status: string
  eligible: boolean
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
}
type Entitlement = {
  eligible: boolean
  expires_at: string | null
  configured_service_status: string | null
  sources: {
    subscription_id: string
    service_code: ServiceCode
    plan_code: string
    included: boolean
    expires_at: string | null
  }[]
}
type Billing = {
  workspace_id: string
  workspace_name: string
  can_manage_billing: boolean
  workspace_status: string
  as_of: string
  subscriptions: Subscription[]
  subscription_entitlements: Record<ServiceCode, Entitlement>
}

type StorageUsage = {
  service_code: "CLIENT_GALLERY" | "EVENT_SALES"
  service_name: string
  has_subscription: boolean
  plan_name: string | null
  subscription_status: string | null
  can_upload: boolean
  storage_limit_bytes: number | null
  used_bytes: number
  reserved_bytes: number
  allocated_bytes: number
  remaining_bytes: number | null
  over_limit_bytes: number
  allocation_percent: number | null
}
type WorkspaceStorage = {
  workspace_id: string
  as_of: string
  services: StorageUsage[]
}

type BillingOrder = {
  order_number: string
  plan_code: string
  plan_name: string
  currency: string
  total_cents: number
  status: string
  checkout_url: string | null
  expires_at: string
  paid_at: string | null
  activated_at: string | null
  subscription_id: string | null
  period_start: string | null
  period_end: string | null
  activation_pending: boolean
}

const services: { code: ServiceCode; label: string }[] = [
  { code: "WEBSITE", label: "Website" },
  { code: "CLIENT_GALLERY", label: "Client Gallery" },
  { code: "EVENT_SALES", label: "Event Sales" },
]
const statusLabels: Record<string, string> = {
  PENDING: "Pending payment",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  CANCELED: "Canceled",
  SCHEDULED: "Scheduled",
  INVALID: "Unavailable",
}
const money = (cents: number, currency = "MYR") =>
  formatDashboardMoney(cents, currency)
const interval = (months: number) => months === 12 ? "year" : "month"
function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-MY", {
    dateStyle: "medium", timeZone: "Asia/Kuala_Lumpur",
  }) : "—"
}
function features(plan: Plan): string[] {
  const items: string[] = []
  if (plan.service_code === "WEBSITE") items.push("Publish your photographer website")
  if (plan.service_code === "CLIENT_GALLERY") {
    items.push(
      "Full-gallery delivery",
      "Public, password and private galleries",
      "Custom pricing and WhatsApp enquiries",
    )
  }
  if (plan.active_event_limit !== null) {
    items.push(`${plan.active_event_limit} active selling ${plan.active_event_limit === 1 ? "event" : "events"}`)
  }
  if (plan.storage_limit_bytes !== null) {
    items.push(`${(plan.storage_limit_bytes / 1_000_000_000).toLocaleString("en-MY")} GB storage`)
  }
  if (plan.service_code === "EVENT_SALES") items.push("Bib number and selfie search")
  if (plan.service_code === "EVENT_SALES" && plan.commission_bps > 0) {
    items.push(`${plan.commission_bps / 100}% commission on paid photo sales`)
  }
  if (plan.service_code === "EVENT_SALES" && plan.customer_service_fee_cents > 0) {
    items.push(`${money(plan.customer_service_fee_cents, plan.currency)} customer service fee per paid order`)
  }
  if (plan.includes_website) items.push("Website publishing included")
  return items
}

function formatStorageBytes(bytes: number): string {
  const value = Math.max(0, bytes)
  if (value < 1_000) return `${value.toLocaleString("en-MY")} B`
  const [divisor, unit] = value >= 1_000_000_000 ? [1_000_000_000, "GB"]
    : value >= 1_000_000 ? [1_000_000, "MB"] : [1_000, "KB"]
  return `${(value / divisor).toLocaleString("en-MY", { maximumFractionDigits: 2 })} ${unit}`
}

function StorageCard({ usage }: { usage: StorageUsage }) {
  const limit = usage.storage_limit_bytes
  const percent = usage.allocation_percent
  const usedPercent = limit !== null && limit > 0
    ? Math.min(100, Math.max(0, usage.used_bytes / limit * 100)) : 0
  const reservedPercent = limit !== null && limit > 0
    ? Math.min(100 - usedPercent, Math.max(0, usage.reserved_bytes / limit * 100)) : 0
  const atLimit = limit !== null && usage.allocated_bytes >= limit
  const nearlyFull = percent !== null && percent >= 90 && !atLimit
  const allowance = !usage.has_subscription ? "No storage plan"
    : limit === null ? "Unlimited storage" : `${formatStorageBytes(limit)} allowance`

  return (
    <section className={`${dashboardCardClass} mt-5 p-6`} aria-label={`${usage.service_name} storage`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF9FA] text-[#087F8C]">
            <HardDrive className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[#173943]">Storage</h2>
            <p className="mt-1 text-xs text-[#70868E]">{usage.service_name}</p>
          </div>
        </div>
        <span className="text-sm font-semibold text-[#55747E]">{allowance}</span>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-[#70868E]">Photos stored</dt>
          <dd className="mt-1 text-xl font-semibold tracking-tight text-[#173943]">{formatStorageBytes(usage.used_bytes)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#70868E]">Pending uploads</dt>
          <dd className="mt-1 text-xl font-semibold tracking-tight text-[#173943]">{formatStorageBytes(usage.reserved_bytes)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#70868E]">{usage.can_upload ? "Available" : "Remaining allowance"}</dt>
          <dd className="mt-1 text-xl font-semibold tracking-tight text-[#173943]">
            {usage.remaining_bytes !== null ? formatStorageBytes(usage.remaining_bytes)
              : usage.has_subscription ? "Unlimited" : "—"}
          </dd>
        </div>
      </dl>

      {limit !== null && percent !== null && (
        <div className="mt-5">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-[#EDF2F4]"
            role="progressbar" aria-label="Storage allocation"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, percent))}
            aria-valuetext={`${formatStorageBytes(usage.used_bytes)} stored, ${formatStorageBytes(usage.reserved_bytes)} reserved, ${formatStorageBytes(limit)} allowance`}>
            <div className={atLimit ? "bg-red-500" : nearlyFull ? "bg-amber-500" : "bg-[#0A929F]"}
              style={{ width: `${usedPercent}%` }} />
            <div className="bg-[#8BD6DE]" style={{ width: `${reservedPercent}%` }} />
          </div>
          <p className="mt-2 text-xs text-[#70868E]">
            {percent.toLocaleString("en-MY", { maximumFractionDigits: 1 })}% allocated
            {usage.reserved_bytes > 0 && " · Includes pending uploads"}
          </p>
        </div>
      )}

      {!usage.can_upload ? (
        <p className="mt-4 text-sm text-[#607B84]">
          {!usage.has_subscription ? "Choose a plan below to start uploading photos."
            : usage.subscription_status === "EXPIRED" ? "Renew your plan to upload more photos. Your existing photos still count toward storage."
            : "Uploading is currently unavailable. Check your subscription or contact support."}
        </p>
      ) : atLimit ? (
        <p role="status" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {usage.over_limit_bytes > 0
            ? `Your storage allowance is exceeded by ${formatStorageBytes(usage.over_limit_bytes)}.`
            : "Your storage allowance is fully allocated."}
          {" "}Permanently delete unused photos to free space.
        </p>
      ) : nearlyFull ? (
        <p role="status" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your storage is nearly full. Permanently delete unused photos to make room for new uploads.
        </p>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-[#70868E]">
        Gallery and Event storage are separate. Photos in Trash still count until permanently deleted.
      </p>
    </section>
  )
}

export default function BillingDashboard() {
  const [selectedService, setSelectedService] = useState<ServiceCode>("EVENT_SALES")
  const [plans, setPlans] = useState<Plan[]>([])
  const [billing, setBilling] = useState<Billing | null>(null)
  const [storage, setStorage] = useState<WorkspaceStorage | null>(null)
  const [storageLoading, setStorageLoading] = useState(true)
  const [storageError, setStorageError] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState("")
  const [paymentOrder, setPaymentOrder] = useState<BillingOrder | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState("")
  const [returnOrder, setReturnOrder] = useState("")
  const [paymentCheckKey, setPaymentCheckKey] = useState(0)
  const checkoutBusy = useRef(false)
  const requestKeys = useRef<Record<string, string>>({})

  useEffect(() => {
    const orderNumber = new URLSearchParams(window.location.search).get("billing_order")
    if (orderNumber && /^EZB-[0-9]{8}-[A-F0-9]{16}$/.test(orderNumber)) {
      setReturnOrder(orderNumber)
    }
  }, [])

  useEffect(() => {
    if (!returnOrder) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let checks = 0
    setCheckingPayment(true)
    setPaymentError("")
    async function checkPayment() {
      try {
        const order = await apiFetch<BillingOrder>(
          `/api/billing/orders/${encodeURIComponent(returnOrder)}`,
        )
        if (!active) return
        setPaymentOrder(order)
        setSelectedService(order.plan_code.startsWith("GALLERY_") ? "CLIENT_GALLERY"
          : order.plan_code.startsWith("WEBSITE_") ? "WEBSITE" : "EVENT_SALES")
        if (order.status === "PAID" && order.activated_at) {
          setCheckingPayment(false)
          setRefreshKey((value) => value + 1)
          return
        }
        if (["CANCELLED", "EXPIRED", "REFUNDED"].includes(order.status) || order.activation_pending) {
          setCheckingPayment(false)
          return
        }
        checks += 1
        if (checks < 10) {
          timer = setTimeout(() => { void checkPayment() }, 3000)
        } else {
          setCheckingPayment(false)
        }
      } catch (reason) {
        if (active) {
          setPaymentError(reason instanceof Error ? reason.message : "Unable to verify payment.")
          setCheckingPayment(false)
        }
      }
    }
    void checkPayment()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [returnOrder, paymentCheckKey])

  async function choosePlan(plan: Plan) {
    if (checkoutBusy.current) return
    checkoutBusy.current = true
    setCheckoutPlan(plan.id)
    setCheckoutError("")
    try {
      requestKeys.current[plan.id] ??= crypto.randomUUID()
      const order = await apiFetch<BillingOrder>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan_code: plan.code,
          idempotency_key: requestKeys.current[plan.id],
        }),
      })
      setPaymentOrder(order)
      if (order.status === "PAID") {
        delete requestKeys.current[plan.id]
        setReturnOrder(order.order_number)
        setPaymentCheckKey((value) => value + 1)
        return
      }
      if (order.checkout_url && new Date(order.expires_at).getTime() > Date.now()
          && ["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status)) {
        window.location.assign(order.checkout_url)
        return
      }
      delete requestKeys.current[plan.id]
      if (order.status === "PENDING_PAYMENT" && !order.checkout_url) {
        throw new Error("Your checkout is being prepared. Please refresh shortly. If it remains unavailable, contact support with your billing order number.")
      }
      throw new Error("This checkout is unavailable. Please try again.")
    } catch (reason) {
      delete requestKeys.current[plan.id]
      setCheckoutError(reason instanceof Error ? reason.message : "Unable to start checkout.")
    } finally {
      checkoutBusy.current = false
      setCheckoutPlan(null)
    }
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError("")
      try {
        const [catalogue, subscriptions] = await Promise.all([
          apiFetch<{ count: number; plans: Plan[] }>("/api/billing/plans"),
          apiFetch<Billing>("/api/billing/subscriptions"),
        ])
        if (active) {
          setPlans(catalogue.plans)
          setBilling(subscriptions)
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load billing information.")
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [refreshKey])

  useEffect(() => {
    let active = true
    async function loadStorage() {
      setStorageLoading(true)
      setStorageError("")
      try {
        const result = await apiFetch<WorkspaceStorage>("/api/billing/storage")
        if (active) setStorage(result)
      } catch (reason) {
        if (active) setStorageError(reason instanceof Error ? reason.message : "Unable to load storage usage.")
      } finally {
        if (active) setStorageLoading(false)
      }
    }
    void loadStorage()
    return () => { active = false }
  }, [refreshKey])

  const availablePlans = plans.filter((plan) => plan.service_code === selectedService)
  const current = billing?.subscriptions.find((item) => item.service_code === selectedService)
  const entitlement = billing?.subscription_entitlements[selectedService]
  const includedSources = entitlement?.sources.filter((source) => source.included) ?? []
  const selectedStorage = storage?.services.find((item) => item.service_code === selectedService)

  return (
    <DashboardPage
      title="Billing"
      section="Workspace"
      icon={<CreditCard className="h-4 w-4" />}
      eyebrow="Plans and subscriptions"
      heading="Your plans"
      description="Choose a plan and manage your workspace subscriptions."
      actions={
        <button type="button" disabled={loading || storageLoading} className={dashboardButtonClass}
          onClick={() => {
            setRefreshKey((value) => value + 1)
            setPaymentCheckKey((value) => value + 1)
          }}>
          <RefreshCw className={`h-4 w-4 ${loading || storageLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
      summary={billing && !loading && !error ? (
        <span className="text-sm font-semibold text-[#55747E]">{billing.workspace_name}</span>
      ) : undefined}
    >
      {(returnOrder || paymentOrder) && (
        <section className={`${dashboardCardClass} mt-6 p-5`} aria-live="polite">
          <p className="text-sm font-semibold text-[#173943]">
            {paymentOrder?.activated_at ? "Payment confirmed — your plan is active."
              : paymentOrder?.activation_pending ? "Payment received. Your activation needs review; please contact support."
              : paymentOrder?.status === "EXPIRED" ? "This checkout has expired. Choose your plan again."
              : paymentOrder?.status === "CANCELLED" ? "Payment was cancelled. Your plan has not been activated."
              : paymentOrder?.status === "REFUNDED" ? "This payment has been refunded."
              : checkingPayment ? "Checking your payment with CHIP..."
              : "Payment has not been confirmed yet. Refresh to check again."}
          </p>
          <p className="mt-2 text-xs text-[#70868E]">{paymentOrder?.order_number ?? returnOrder}</p>
          {paymentOrder?.period_end && (
            <p className="mt-2 text-sm text-[#607B84]">
              {paymentOrder.plan_name} · Paid period ends {date(paymentOrder.period_end)}
            </p>
          )}
          {paymentError && <p role="alert" className="mt-3 text-sm text-red-700">{paymentError}</p>}
        </section>
      )}
      {checkoutError && (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {checkoutError}
        </p>
      )}
      {loading ? (
        <div className="mt-8 flex items-center gap-3 text-sm text-[#607B84]" role="status">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading your plans...
        </div>
      ) : error ? (
        <div role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : billing ? (
        <>
          <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Choose a service">
            {services.map((service) => (
              <button key={service.code} type="button" aria-pressed={selectedService === service.code}
                onClick={() => setSelectedService(service.code)}
                className={selectedService === service.code ? dashboardPrimaryButtonClass : dashboardButtonClass}>
                {service.label}
              </button>
            ))}
          </div>

          <section className={`${dashboardCardClass} mt-6 p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#70868E]">Your subscription</p>
                <h2 className="mt-2 text-xl font-semibold text-[#173943]">
                  {current ? current.plan_name : includedSources.length > 0 ? "Website included" : "No subscription yet"}
                </h2>
                {current && (
                  <p className="mt-2 text-sm text-[#607B84]">
                    {money(current.price_cents, current.currency)} / {interval(current.billing_interval_months)}
                  </p>
                )}
                {includedSources.length > 0 && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-[#187D62]">
                    <Globe2 className="h-4 w-4 shrink-0" />
                    Website access is included through your active Gallery or Event Sales subscription.
                  </p>
                )}
                {!current && includedSources.length === 0 && (
                  <p className="mt-2 text-sm text-[#607B84]">Compare the available plans below.</p>
                )}
              </div>
              {current && (
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${current.eligible ? "bg-[#E3F5EF] text-[#187D62]" : "bg-[#F1F5F6] text-[#607B84]"}`}>
                  {statusLabels[current.effective_status] ?? current.effective_status}
                </span>
              )}
            </div>
            {current?.current_period_end && (
              <p className="mt-4 text-sm text-[#607B84]">
                Subscription period: {date(current.current_period_start)} – {date(current.current_period_end)}
              </p>
            )}
            {current?.eligible && (
              <p className="mt-2 text-sm text-[#607B84]">
                Active until {date(current.current_period_end)}. Renew manually to continue.
              </p>
            )}
            {includedSources.length > 0 && (
              <p className="mt-4 text-sm text-[#607B84]">Included website access until {date(entitlement?.expires_at ?? null)}.</p>
            )}
          </section>

          {selectedService !== "WEBSITE" && (
            storageLoading ? (
              <div className={`${dashboardCardClass} mt-5 flex items-center gap-3 p-6 text-sm text-[#607B84]`} role="status">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading storage usage...
              </div>
            ) : storageError ? (
              <div className={`${dashboardCardClass} mt-5 p-6`}>
                <p role="alert" className="text-sm text-red-700">{storageError}</p>
                <button type="button" className={`${dashboardButtonClass} mt-3`}
                  onClick={() => setRefreshKey((value) => value + 1)}>
                  <RefreshCw className="h-4 w-4" /> Retry
                </button>
              </div>
            ) : selectedStorage ? <StorageCard usage={selectedStorage} /> : (
              <p className="mt-5 text-sm text-[#607B84]">Storage usage is currently unavailable. Refresh to try again.</p>
            )
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {availablePlans.map((plan) => (
              <article key={plan.id} className={`${dashboardCardClass} p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[#173943]">{plan.name}</h2>
                  {current?.eligible && current.plan_id === plan.id && (
                    <span className="rounded-full bg-[#E3F5EF] px-3 py-1 text-xs font-semibold text-[#187D62]">Current plan</span>
                  )}
                </div>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-[#123743]">
                  {money(plan.price_cents, plan.currency)}
                </p>
                <p className="mt-1 text-sm text-[#70868E]">per {interval(plan.billing_interval_months)}</p>
                <ul className="mt-6 space-y-3 border-t border-[#E7EEF0] pt-5">
                  {features(plan).map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-[#55747E]">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-[#0A929F]" />{feature}
                    </li>
                  ))}
                </ul>
                <button type="button"
                  disabled={!billing.can_manage_billing || checkoutPlan !== null || checkingPayment
                    || (selectedService === "WEBSITE" && includedSources.length > 0)
                    || (!!current?.eligible && current.plan_id !== plan.id)}
                  onClick={() => { void choosePlan(plan) }}
                  className={`${dashboardPrimaryButtonClass} mt-6 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50`}>
                  {checkoutPlan === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {checkoutPlan === plan.id ? "Preparing checkout..."
                    : selectedService === "WEBSITE" && includedSources.length > 0 ? "Website included"
                    : current?.eligible && current.plan_id === plan.id ? "Renew plan"
                    : current?.eligible ? "Available after current period"
                    : "Choose plan"}
                </button>
              </article>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-[#70868E]">
            {billing.can_manage_billing
              ? "Pay securely through FPX. Your plan activates after payment verification. Renewals are paid manually; there is no automatic debit."
              : "Only the workspace owner can purchase or renew a plan."}
          </p>
          {availablePlans.length === 0 && (
            <p className="mt-6 text-sm text-[#607B84]">No plans are currently available for this service.</p>
          )}
          {selectedService === "CLIENT_GALLERY" && (
            <p className="mt-5 text-sm leading-6 text-[#70868E]">
              Arrange customer payments directly through WhatsApp. No commission or customer service fee.
            </p>
          )}
        </>
      ) : null}
      {billing?.can_manage_billing && <SubscriptionPaymentHistory refreshKey={refreshKey} />}
      {billing && (
        <section className={`${dashboardCardClass} mt-8 p-6`}>
          <h2 className="text-lg font-semibold text-[#173943]">Billing support</h2>
          <p className="mt-2 text-sm leading-6 text-[#607B84]">
            Questions about your plan or payment? Email our support team with your workspace name and order number.
          </p>
          <a href="mailto:ezfotoo@gmail.com?subject=EZFOTOO%20billing%20support"
            className={`${dashboardButtonClass} mt-4`}>ezfotoo@gmail.com</a>
        </section>
      )}
    </DashboardPage>
  )
}
