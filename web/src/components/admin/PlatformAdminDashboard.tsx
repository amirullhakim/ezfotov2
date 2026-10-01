"use client"

import {
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Globe2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  Server,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import AdminSystemStatus from "@/components/admin/AdminSystemStatus"

import { EzfotooBrand } from "@/components/brand/EzfotooBrand"
import {
  DashboardHeader,
  dashboardButtonClass,
  dashboardCardClass,
  formatDashboardMoney as money,
} from "@/components/dashboard/DashboardPage"
import { apiFetch } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"


type Overview = {
  photographers: {
    total: number
  }

  workspaces: {
    total: number
    active: number
  }

  services: {
    active: number
  }

  domains: {
    total: number
  }

  commerce: {
    available: boolean
    orders: number | null
    gross_sales_rm: number | null
    platform_revenue_rm: number | null
  }
}


type WorkspaceService = {
  code: string
  name: string
  status: string
}


type Workspace = {
  id: string
  name: string
  business_name: string | null
  slug: string
  status: string

  owner: {
    full_name: string | null
    email: string | null
  }

  domain: {
    hostname: string
    verified: boolean
  } | null

  services: WorkspaceService[]
}


type WorkspaceResponse = {
  count: number
  workspaces: Workspace[]
}


type CommerceOverview = {
  currency: string
  paid_orders: number
  photos_sold: number
  photo_sales_cents: number
  service_fees_cents: number
  total_collected_cents: number
}


const navItems = [
  { label: "Subscriptions", icon: Package },
  {
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    label: "Workspaces",
    icon: Users,
  },
  {
    label: "Services",
    icon: Package,
  },
  {
    label: "Finance",
    icon: CircleDollarSign,
  },
  {
    label: "Infrastructure",
    icon: Server,
  },
]


export default function PlatformAdminDashboard({
  email,
}: {
  email: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [overview, setOverview] =
    useState<Overview | null>(null)

  const [workspaces, setWorkspaces] =
    useState<Workspace[]>([])

  const [loading, setLoading] =
    useState(true)

  const [updating, setUpdating] =
    useState<string | null>(null)


  const [selectedSection, setSelectedSection] = useState("Overview")
  const [query, setQuery] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [dataRevision, setDataRevision] = useState(0)
  const filteredWorkspaces = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return workspaces
    return workspaces.filter((workspace) => [workspace.name, workspace.business_name, workspace.slug, workspace.owner.full_name, workspace.owner.email, workspace.domain?.hostname].some((value) => value?.toLowerCase().includes(term)))
  }, [workspaces, query])

  function selectSection(label: string) {
    if (label === "Subscriptions") { router.push("/admin/billing"); return }
    if (label === "Finance") { router.push("/admin/finance"); return }
    setSelectedSection(label)
    if (label === "Services") setQuery("")
    const target = label === "Infrastructure" ? "system" : label === "Overview" ? "overview" : "workspaces"
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const loadAdminData = useCallback(async () => {
    setRefreshing(true)
    setErrorMessage("")
    try {
      const [
        overviewResult,
        workspacesResult,
      ] = await Promise.all([
        apiFetch<Overview>(
          "/api/admin/overview"
        ),

        apiFetch<WorkspaceResponse>(
          "/api/admin/workspaces"
        ),
      ])

      setOverview(overviewResult)
      setWorkspaces(
        workspacesResult.workspaces
      )
      setDataRevision((value) => value + 1)

    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Unable to load the platform overview.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadAdminData()
  }, [loadAdminData])


  async function toggleService(
    workspace: Workspace,
    service: WorkspaceService
  ) {
    const key =
      `${workspace.id}-${service.code}`

    setUpdating(key)

    try {
      const nextStatus =
        service.status === "ACTIVE"
          ? "INACTIVE"
          : "ACTIVE"

      await apiFetch(
        `/api/admin/workspaces/${workspace.id}/services/${service.code}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      )

      await loadAdminData()

    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Unable to update service access.")
    } finally {
      setUpdating(null)
    }
  }


  async function handleLogout() {
    await supabase.auth.signOut()

    router.push("/login")
    router.refresh()
  }


  if (!loading && !overview) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F6F9FA] px-5"><div className={`${dashboardCardClass} max-w-lg p-7`}><h1 className="text-lg font-semibold text-[#173943]">Platform overview unavailable</h1><p role="alert" className="mt-3 text-sm text-[#A44D57]">{errorMessage || "Unable to load platform data."}</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={refreshing} onClick={() => void loadAdminData()} className={dashboardButtonClass}>{refreshing ? "Loading..." : "Try again"}</button><Link href="/dashboard" className={dashboardButtonClass}>My workspace</Link></div></div></div>
  }

  if (loading || !overview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F9FA]">
        <div className="flex items-center gap-3 text-sm font-semibold text-[#58717A]">
          <Loader2 className="h-5 w-5 animate-spin text-[#0BA5B4]" />
          Loading EZFOTOO platform...
        </div>
      </div>
    )
  }


  return (
    <main className="min-h-screen bg-[#F5F8F9]">

      <div className="flex min-h-screen">

        <aside className="hidden w-[268px] shrink-0 border-r border-[#E2EAEC] bg-white lg:flex lg:flex-col">

          <div className="flex h-20 items-center border-b border-[#EDF1F2] px-6">
            <EzfotooBrand />
          </div>


          <div className="px-4 py-6">

            <div className="mb-6 rounded-2xl border border-[#DCEFF1] bg-[#F1FBFC] p-4">

              <div className="flex items-center gap-2">

                <ShieldCheck className="h-4 w-4 text-[#0798A6]" />

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#087F8C]">
                  Platform Admin
                </p>

              </div>

              <p className="mt-2 text-xs leading-5 text-[#71868D]">
                Full EZFOTOO platform access
              </p>

            </div>


            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.17em] text-[#9AABB1]">
              Platform
            </p>


            <nav className="mt-3 space-y-1">
              {navItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => selectSection(label)}
                  aria-current={selectedSection === label ? "location" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    selectedSection === label
                      ? "bg-[#EDF9FA] text-[#087F8C]"
                      : "text-[#667A83] hover:bg-[#F6F9FA] hover:text-[#284650]"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </button>
              ))}
            </nav>

          </div>


          <div className="mt-auto border-t border-[#EDF1F2] p-4">

            <button
              onClick={() =>
                router.push("/dashboard")
              }
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#667A83] hover:bg-[#F6F9FA]"
            >
              <Building2 className="h-[18px] w-[18px]" />
              My Workspace
            </button>


            <button type="button" onClick={() => router.push("/admin/settings")} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#667A83] hover:bg-[#F6F9FA]">
              <Settings className="h-[18px] w-[18px]" />
              Settings
            </button>


            <button
              onClick={handleLogout}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#A44D57] hover:bg-[#FFF6F7]"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign out
            </button>

          </div>

        </aside>


        <section className="min-w-0 flex-1">

          <DashboardHeader
            title="Platform overview"
            section="Platform Admin"
            icon={<ShieldCheck className="h-4 w-4" />}
            backHref="/dashboard"
            backLabel="Back to my workspace"
            actions={
              <>
                <button type="button" disabled={refreshing || updating !== null} onClick={() => void loadAdminData()} className={dashboardButtonClass} aria-label="Refresh platform overview"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Refresh</span></button>
                <Link href="/admin/billing" className={`${dashboardButtonClass} lg:hidden`}><Package className="h-4 w-4" />Subscriptions</Link>
                <Link href="/admin/settings" className={`${dashboardButtonClass} lg:hidden`}><Settings className="h-4 w-4" />Settings</Link>
                <Link href="/admin/finance" className={`${dashboardButtonClass} lg:hidden`}>
                  <CircleDollarSign className="h-4 w-4" />
                  Finance
                </Link>
                <div className="hidden max-w-[240px] text-right xl:block">
                  <p className="truncate text-sm font-semibold text-[#314C56]" title={email}>
                    {email}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-[#0A919E]">Super Admin</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`${dashboardButtonClass} lg:hidden`}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            }
          />


          <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8 lg:py-10">
            {errorMessage && <p role="alert" className="mb-6 rounded-xl border border-[#F2D5D8] bg-[#FFF6F7] p-4 text-sm text-[#A44D57]">{errorMessage}</p>}
            <div id="overview" className="scroll-mt-28">

              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">

                <ShieldCheck className="h-4 w-4" />

                Platform Overview

              </div>


              <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#112D38]">
                Platform overview
              </h1>


              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6A7E86]">
                Manage photography workspaces, service access and platform sales.
              </p>

            </div>


            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <MetricCard
                label="Photographers"
                value={String(
                  overview.photographers.total
                )}
                icon={Users}
              />

              <MetricCard
                label="Workspaces"
                value={String(
                  overview.workspaces.total
                )}
                icon={Building2}
              />

              <MetricCard
                label="Enabled services"
                value={String(
                  overview.services.active
                )}
                icon={Package}
              />

              <MetricCard
                label="Domains"
                value={String(
                  overview.domains.total
                )}
                icon={Globe2}
              />

            </div>


            <div className="mt-8 grid items-start gap-6 xl:grid-cols-[1fr_330px]">

              <section id="workspaces" className={`${dashboardCardClass} scroll-mt-28 overflow-hidden`}>

                <div className="flex items-center justify-between border-b border-[#E8EEF0] px-6 py-5">

                  <div>

                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#899A9F]">
                      Photographers
                    </p>

                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#173943]">
                      Photography workspaces
                    </h2>

                  </div>

                  <span className="rounded-full bg-[#EEF8F9] px-3 py-1 text-xs font-bold text-[#087F8C]">
                    {filteredWorkspaces.length} of {workspaces.length}
                  </span>

                </div>


                <div className="border-b border-[#E8EEF0] px-6 py-4"><label className="relative block"><span className="sr-only">Search workspaces</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#81949B]" /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search workspace, owner or address" className="h-11 w-full rounded-xl border border-[#D4E2E5] bg-[#FBFCFC] pl-10 pr-3 text-sm text-[#173640] outline-none focus:border-[#0A929F] focus:ring-2 focus:ring-[#47C6CE]/20" /></label></div>
                <div className="flex flex-wrap gap-2 border-b border-[#E8EEF0] px-6 py-3 lg:hidden">{navItems.filter((item) => item.label === "Workspaces" || item.label === "Services" || item.label === "Infrastructure").map((item) => <button key={item.label} type="button" onClick={() => selectSection(item.label)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${selectedSection === item.label ? "bg-[#EDF9FA] text-[#087F8C]" : "text-[#667A83] hover:bg-[#F6F9FA]"}`}>{item.label}</button>)}</div>
                <div className="divide-y divide-[#EDF1F2]">
                  {filteredWorkspaces.length === 0 && <p className="px-6 py-12 text-center text-sm text-[#71858C]">{query.trim() ? "No workspaces match your search." : "No photography workspaces yet."}</p>}
                  {filteredWorkspaces.map(
                    (workspace) => (
                      <WorkspaceRow
                        key={workspace.id}
                        workspace={workspace}
                        updating={updating}
                        expandServices={selectedSection === "Services"}
                        onToggleService={
                          toggleService
                        }
                      />
                    )
                  )}

                </div>

              </section>


              <div className="space-y-5">

                <PlatformCommerceCard refreshKey={dataRevision} />


                <AdminSystemStatus refreshKey={dataRevision} />


              </div>

            </div>

          </div>

        </section>

      </div>

    </main>
  )
}


function WorkspaceRow({
  workspace,
  updating,
  expandServices,
  onToggleService,
}: {
  workspace: Workspace
  updating: string | null
  expandServices: boolean
  onToggleService: (
    workspace: Workspace,
    service: WorkspaceService
  ) => void
}) {
  const [expanded, setExpanded] =
    useState(false)

  useEffect(() => { setExpanded(expandServices) }, [expandServices])

  return (
    <div>

      <button
        type="button"
        aria-expanded={expanded}
        onClick={() =>
          setExpanded((value) => !value)
        }
        className="flex w-full items-center gap-4 px-6 py-5 text-left transition hover:bg-[#FAFCFC]"
      >

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF8F9] text-sm font-bold text-[#087F8C]">
          {workspace.name
            .substring(0, 2)
            .toUpperCase()}
        </div>


        <div className="min-w-0 flex-1">

          <p className="truncate font-semibold text-[#294A53]">
            {workspace.name}
          </p>

          <p className="mt-1 truncate text-xs text-[#84969D]">
            {workspace.owner.full_name ??
              "Unknown owner"}
            {" · "}
            {workspace.owner.email ??
              "No email"}
          </p>

        </div>


        <div className="hidden text-right md:block">

          <p className="text-sm font-semibold text-[#425F68]">
            {workspace.domain?.hostname ??
              workspace.slug}
          </p>

          <p className="mt-1 text-xs text-[#8A9BA1]">
            {workspace.status}
          </p>

        </div>


        {expanded ? (
          <ChevronDown className="h-4 w-4 text-[#82949A]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#82949A]" />
        )}

      </button>


      {expanded && (
        <div className="border-t border-[#EDF1F2] bg-[#FBFCFC] px-6 py-5">

          <p className="mb-4 text-xs font-bold uppercase tracking-[0.13em] text-[#899A9F]">
            Service Access
          </p>


          <div className="grid gap-3 md:grid-cols-3">

            {workspace.services.map(
              (service) => {
                const key =
                  `${workspace.id}-${service.code}`

                const isUpdating =
                  updating === key

                const active =
                  service.status === "ACTIVE"


                return (
                  <div
                    key={service.code}
                    className="rounded-2xl border border-[#E2EAEC] bg-white p-4"
                  >

                    <p className="font-semibold text-[#294A53]">
                      {service.name}
                    </p>

                    <p className="mt-1 text-xs text-[#899A9F]">
                      {service.code}
                    </p>


                    <button
                      type="button"
                      disabled={updating !== null}
                      onClick={() =>
                        onToggleService(
                          workspace,
                          service
                        )
                      }
                      className={`mt-4 flex h-9 w-full items-center justify-center rounded-xl text-xs font-bold transition ${
                        active
                          ? "bg-[#E8F7F2] text-[#187D62] hover:bg-[#DDF3EA]"
                          : "bg-[#073B4C] text-white hover:bg-[#0B5363]"
                      }`}
                    >

                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : active ? (
                        "Deactivate"
                      ) : (
                        "Activate"
                      )}

                    </button>

                  </div>
                )
              }
            )}

          </div>

        </div>
      )}

    </div>
  )
}


function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Users
}) {
  return (
    <div className={`${dashboardCardClass} p-6`}>

      <div className="flex items-center justify-between">

        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#899A9F]">
          {label}
        </p>

        <Icon className="h-4 w-4 text-[#0B9EAB]" />

      </div>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#123743]">
        {value}
      </p>

    </div>
  )
}


function PlatformCommerceCard({ refreshKey }: { refreshKey: number }) {
  const [commerce, setCommerce] =
    useState<CommerceOverview | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState("")


  useEffect(() => {
    let active = true

    async function loadCommerce() {
      setLoading(true)
      setErrorMessage("")
      try {
        const result =
          await apiFetch<CommerceOverview>(
            "/api/admin/commerce/overview"
          )

        if (active) {
          setCommerce(result)
        }

      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load commerce figures."
          )
        }

      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadCommerce()

    return () => {
      active = false
    }
  }, [refreshKey])



  return (
    <section className={`${dashboardCardClass} p-6`}>

      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F8F9]">
        <CircleDollarSign className="h-5 w-5 text-[#0798A6]" />
      </div>

      <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#899A9F]">
        Sales overview
      </p>

      <h3 className="mt-2 text-lg font-semibold text-[#183A44]">
        Event Sales
      </h3>

      <p className="mt-2 text-xs leading-5 text-[#71858C]">
        Paid orders across all workspaces · MYR
      </p>


      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-[#71858C]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sales...
        </div>
      ) : errorMessage ? (
        <p role="alert" className="mt-5 text-sm text-[#A44D57]">
          {errorMessage}
        </p>
      ) : commerce ? (
        <div className="mt-5 space-y-3 border-t border-[#E8EEF0] pt-5 text-sm">

          <div className="flex items-center justify-between gap-3">
            <span className="text-[#71858C]">
              Paid orders
            </span>
            <span className="font-semibold text-[#183A44]">
              {commerce.paid_orders}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[#71858C]">
              Photos sold
            </span>
            <span className="font-semibold text-[#183A44]">
              {commerce.photos_sold}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[#71858C]">
              Photo sales
            </span>
            <span className="font-semibold text-[#183A44]">
              {money(commerce.photo_sales_cents)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[#71858C]">
              Service fees collected
            </span>
            <span className="font-semibold text-[#183A44]">
              {money(commerce.service_fees_cents)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#E8EEF0] pt-3">
            <span className="font-semibold text-[#183A44]">
              Total collected
            </span>
            <span className="font-semibold text-[#183A44]">
              {money(commerce.total_collected_cents)}
            </span>
          </div>

        </div>
      ) : null}

      <p className="mt-5 text-xs leading-5 text-[#899A9F]">
        Sales figures before payment processing costs and payouts.
      </p>
      <Link href="/admin/finance" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0A929F]">View finance <ChevronRight className="h-4 w-4" /></Link>

    </section>
  )
}