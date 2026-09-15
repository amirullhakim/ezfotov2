"use client"

import {
  Activity,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Database,
  Globe2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  useEffect,
  useState,
} from "react"

import { EzfotooBrand } from "@/components/brand/EzfotooBrand"
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


const navItems = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    active: true,
  },
  {
    label: "Photographers",
    icon: Users,
  },
  {
    label: "Services",
    icon: Package,
  },
  {
    label: "Commerce",
    icon: CircleDollarSign,
  },
  {
    label: "Analytics",
    icon: BarChart3,
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


  async function loadAdminData() {
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

    } catch {
      router.replace("/dashboard")

    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    loadAdminData()
  }, [])


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

    } finally {
      setUpdating(null)
    }
  }


  async function handleLogout() {
    await supabase.auth.signOut()

    router.push("/login")
    router.refresh()
  }


  if (
    loading ||
    !overview
  ) {
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

          <div className="flex h-[78px] items-center border-b border-[#EDF1F2] px-6">
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

              {navItems.map(
                ({
                  label,
                  icon: Icon,
                  active,
                }) => (
                  <button
                    key={label}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-[#EDF9FA] text-[#087F8C]"
                        : "text-[#667A83] hover:bg-[#F6F9FA] hover:text-[#284650]"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {label}
                  </button>
                )
              )}

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


            <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#667A83] hover:bg-[#F6F9FA]">
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

          <header className="flex h-[78px] items-center justify-between border-b border-[#E2EAEC] bg-white px-6 lg:px-10">

            <div>
              <p className="text-sm font-semibold text-[#193A44]">
                EZFOTOO Platform
              </p>

              <p className="mt-0.5 text-xs text-[#84969D]">
                Administration
              </p>
            </div>


            <div className="text-right">

              <p className="text-sm font-semibold text-[#314C56]">
                {email}
              </p>

              <p className="mt-0.5 text-xs font-medium text-[#0A919E]">
                Super Admin
              </p>

            </div>

          </header>


          <div className="mx-auto max-w-[1500px] px-6 py-9 lg:px-10">

            <div>

              <div className="flex items-center gap-2 text-sm font-semibold text-[#0A929F]">

                <ShieldCheck className="h-4 w-4" />

                Platform Overview

              </div>


              <h1 className="mt-2 text-[36px] font-semibold tracking-[-0.045em] text-[#112D38]">
                EZFOTOO at a glance.
              </h1>


              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6A7E86]">
                Monitor photographers, services,
                domains and the overall health of
                the EZFOTOO platform.
              </p>

            </div>


            <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

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
                label="Active Services"
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


            <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_330px]">

              <section className="ez-card overflow-hidden">

                <div className="flex items-center justify-between border-b border-[#E8EEF0] px-6 py-5">

                  <div>

                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#899A9F]">
                      Photographers
                    </p>

                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#173943]">
                      Photography Workspaces
                    </h2>

                  </div>

                  <span className="rounded-full bg-[#EEF8F9] px-3 py-1 text-xs font-bold text-[#087F8C]">
                    {workspaces.length} total
                  </span>

                </div>


                <div className="divide-y divide-[#EDF1F2]">

                  {workspaces.map(
                    (workspace) => (
                      <WorkspaceRow
                        key={workspace.id}
                        workspace={workspace}
                        updating={updating}
                        onToggleService={
                          toggleService
                        }
                      />
                    )
                  )}

                </div>

              </section>


              <div className="space-y-5">

                <section className="ez-card p-6">

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F8F9]">
                    <CircleDollarSign className="h-5 w-5 text-[#0798A6]" />
                  </div>

                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#899A9F]">
                    Commerce
                  </p>

                  <h3 className="mt-2 text-lg font-semibold text-[#183A44]">
                    Sales & Revenue
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-[#71858C]">
                    Revenue analytics will become
                    available when the EZFOTOO order
                    and payment system is connected.
                  </p>

                  <span className="mt-5 inline-flex rounded-full bg-[#F1F4F5] px-3 py-1 text-xs font-semibold text-[#71858C]">
                    Coming in Commerce Phase
                  </span>

                </section>


                <section className="rounded-[22px] bg-[#073B4C] p-6 text-white">

                  <Activity className="h-6 w-6 text-[#55D9E2]" />

                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#79BBC2]">
                    System
                  </p>

                  <h3 className="mt-2 text-lg font-semibold">
                    Platform operational
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-[#B8CDD2]">
                    FastAPI and Supabase PostgreSQL
                    are connected and serving the
                    EZFOTOO platform.
                  </p>

                </section>


                <section className="ez-card p-6">

                  <Database className="h-5 w-5 text-[#0B9EAB]" />

                  <h3 className="mt-4 font-semibold text-[#264750]">
                    Infrastructure
                  </h3>

                  <div className="mt-4 space-y-3 text-sm">

                    <StatusRow
                      label="Database"
                      value="Connected"
                    />

                    <StatusRow
                      label="API"
                      value="Online"
                    />

                    <StatusRow
                      label="Authentication"
                      value="Supabase"
                    />

                  </div>

                </section>

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
  onToggleService,
}: {
  workspace: Workspace
  updating: string | null
  onToggleService: (
    workspace: Workspace,
    service: WorkspaceService
  ) => void
}) {
  const [expanded, setExpanded] =
    useState(false)


  return (
    <div>

      <button
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
                      disabled={isUpdating}
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
    <div className="ez-card p-5">

      <div className="flex items-center justify-between">

        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#899A9F]">
          {label}
        </p>

        <Icon className="h-4 w-4 text-[#0B9EAB]" />

      </div>

      <p className="mt-4 text-[27px] font-semibold tracking-[-0.04em] text-[#173A44]">
        {value}
      </p>

    </div>
  )
}


function StatusRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between">

      <span className="text-[#758A91]">
        {label}
      </span>

      <span className="flex items-center gap-2 font-semibold text-[#35545D]">

        <span className="h-2 w-2 rounded-full bg-[#28B887]" />

        {value}

      </span>

    </div>
  )
}