"use client"

import {
  BarChart3,
  Camera,
  ChevronRight,
  Globe2,
  Images,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react"

import {
  usePathname,
  useRouter,
} from "next/navigation"

import {
  useEffect,
  useMemo,
  useState,
} from "react"

import { EzfotooBrand } from "@/components/brand/EzfotooBrand"
import { apiFetch } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"


type Service = {
  code: string
  name: string
  status: string
}


type WorkspaceData = {
  onboarded: boolean

  workspace: {
    id: string
    name: string
    business_name: string | null
    slug: string
    status: string
    role: string

    domain: {
      hostname: string
      type: string
      verified: boolean
    } | null

    services: Service[]
  } | null
}


type NavigationItem = {
  label: string
  icon: typeof LayoutDashboard
  href?: string
  serviceCode?: string
  implemented: boolean
}


const navigation: NavigationItem[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    href: "/dashboard",
    implemented: true,
  },
  {
    label: "Website",
    icon: Globe2,
    href: "/dashboard/website",
    serviceCode: "WEBSITE",
    implemented: true,
  },
  {
    label: "Client Galleries",
    icon: Images,
    serviceCode: "CLIENT_GALLERY",
    implemented: false,
  },
  {
    label: "Event Sales",
    icon: Camera,
    serviceCode: "EVENT_SALES",
    implemented: false,
  },
  {
    label: "Orders",
    icon: ShoppingBag,
    implemented: false,
  },
  {
    label: "Customers",
    icon: Users,
    implemented: false,
  },
  {
    label: "Analytics",
    icon: BarChart3,
    implemented: false,
  },
]


export default function WorkspaceDashboard({
  email,
}: {
  email: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  const supabase = createClient()


  const [data, setData] =
    useState<WorkspaceData | null>(
      null
    )

  const [loading, setLoading] =
    useState(true)


  useEffect(() => {
    async function loadWorkspace() {
      try {
        const result =
          await apiFetch<WorkspaceData>(
            "/api/workspaces/me"
          )


        if (!result.onboarded) {
          router.replace(
            "/onboarding"
          )

          return
        }


        setData(result)

      } catch {
        router.replace(
          "/login"
        )

      } finally {
        setLoading(false)
      }
    }


    loadWorkspace()
  }, [router])


  const activeServices =
    useMemo(
      () =>
        data?.workspace?.services.filter(
          (service) =>
            service.status ===
            "ACTIVE"
        ).length ?? 0,
      [data]
    )


  async function handleLogout() {
    await supabase.auth.signOut()

    router.push(
      "/login"
    )

    router.refresh()
  }


  if (
    loading ||
    !data?.workspace
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7FAFB]">

        <div className="flex items-center gap-3 text-sm font-semibold text-[#58717A]">

          <Loader2 className="h-5 w-5 animate-spin text-[#0BA5B4]" />

          Loading your workspace...

        </div>

      </div>
    )
  }


  const workspace =
    data.workspace


  function isServiceActive(
    serviceCode?: string
  ) {
    if (!serviceCode) {
      return true
    }


    return workspace.services.some(
      (service) =>
        service.code ===
          serviceCode &&
        service.status ===
          "ACTIVE"
    )
  }


  function handleNavigation(
    item: NavigationItem
  ) {
    if (
      !item.implemented ||
      !item.href
    ) {
      return
    }


    if (
      item.serviceCode &&
      !isServiceActive(
        item.serviceCode
      )
    ) {
      return
    }


    router.push(
      item.href
    )
  }


  function handleServiceClick(
    service: Service
  ) {
    if (
      service.status !==
      "ACTIVE"
    ) {
      return
    }


    if (
      service.code ===
      "WEBSITE"
    ) {
      router.push(
        "/dashboard/website"
      )
    }
  }


  return (
    <main className="min-h-screen bg-[#F6F9FA]">

      <div className="flex min-h-screen">

        {/* SIDEBAR */}
        <aside className="hidden w-[260px] shrink-0 border-r border-[#E3EAEC] bg-white lg:flex lg:flex-col">

          <div className="flex h-[78px] items-center border-b border-[#EDF1F2] px-6">

            <EzfotooBrand />

          </div>


          <div className="px-4 py-6">

            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9AABB1]">
              Workspace
            </p>


            <nav className="mt-3 space-y-1">

              {navigation.map(
                (item) => {
                  const Icon =
                    item.icon


                  const serviceActive =
                    isServiceActive(
                      item.serviceCode
                    )


                  const available =
                    item.implemented &&
                    serviceActive &&
                    Boolean(
                      item.href
                    )


                  const active =
                    pathname ===
                      item.href ||
                    (
                      item.href !==
                        "/dashboard" &&
                      item.href &&
                      pathname.startsWith(
                        `${item.href}/`
                      )
                    )


                  return (
                    <button
                      key={
                        item.label
                      }
                      type="button"
                      disabled={
                        !available
                      }
                      onClick={() =>
                        handleNavigation(
                          item
                        )
                      }
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                        active
                          ? "bg-[#EDF9FA] text-[#087F8C]"
                          : available
                            ? "text-[#667A83] hover:bg-[#F6F9FA] hover:text-[#284650]"
                            : "cursor-not-allowed text-[#A8B5B9]"
                      }`}
                    >

                      <Icon className="h-[18px] w-[18px]" />

                      <span>
                        {item.label}
                      </span>


                      {!item.implemented && (
                        <span className="ml-auto rounded-full bg-[#F2F5F6] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#91A1A6]">
                          Soon
                        </span>
                      )}


                      {item.implemented &&
                        item.serviceCode &&
                        !serviceActive && (
                          <span className="ml-auto rounded-full bg-[#F2F5F6] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#91A1A6]">
                            Inactive
                          </span>
                        )}

                    </button>
                  )
                }
              )}

            </nav>

          </div>


          <div className="mt-auto border-t border-[#EDF1F2] p-4">

            <button
              type="button"
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#A8B5B9]"
            >

              <Settings className="h-[18px] w-[18px]" />

              Settings

              <span className="ml-auto rounded-full bg-[#F2F5F6] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#91A1A6]">
                Soon
              </span>

            </button>


            <button
              type="button"
              onClick={
                handleLogout
              }
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#A44D57] hover:bg-[#FFF6F7]"
            >

              <LogOut className="h-[18px] w-[18px]" />

              Sign out

            </button>

          </div>

        </aside>


        {/* MAIN */}
        <section className="min-w-0 flex-1">

          <header className="flex h-[78px] items-center justify-between border-b border-[#E3EAEC] bg-white px-6 lg:px-9">

            <div>

              <p className="text-sm font-semibold text-[#173640]">
                {workspace.name}
              </p>


              <p className="mt-0.5 text-xs text-[#84969D]">
                {workspace.role}
              </p>

            </div>


            <div className="text-right">

              <p className="text-sm font-semibold text-[#314C56]">
                {email}
              </p>


              <p className="mt-0.5 text-xs text-[#8A9BA1]">
                Photographer account
              </p>

            </div>

          </header>


          <div className="mx-auto max-w-[1440px] px-6 py-9 lg:px-10">

            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">

              <div>

                <p className="text-sm font-semibold text-[#0A929F]">
                  Overview
                </p>


                <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.04em] text-[#112D38]">
                  Welcome to{" "}
                  {workspace.name}.
                </h1>


                <p className="mt-3 max-w-xl text-sm leading-6 text-[#6A7E86]">
                  Build your photography presence and manage every part of your EZFOTOO workspace.
                </p>

              </div>

            </div>


            {/* STATS */}
            <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <StatCard
                label="Active services"
                value={`${activeServices} / ${workspace.services.length}`}
              />


              <StatCard
                label="Workspace status"
                value={
                  workspace.status
                }
              />


              <StatCard
                label="Account role"
                value={
                  workspace.role
                }
              />


              <StatCard
                label="Domain"
                value={
                  workspace.domain
                    ? workspace.domain
                        .verified
                      ? "Connected"
                      : "Reserved"
                    : "Not configured"
                }
              />

            </div>


            <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">

              {/* SERVICES */}
              <section className="ez-card p-6 lg:p-7">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#81949B]">
                      Your services
                    </p>


                    <h2 className="mt-2 text-xl font-semibold text-[#163741]">
                      Build your photography platform
                    </h2>

                  </div>


                  <Package className="h-5 w-5 text-[#0BA3B1]" />

                </div>


                <div className="mt-6 space-y-3">

                  {workspace.services.map(
                    (service) => {
                      const clickable =
                        service.status ===
                          "ACTIVE" &&
                        service.code ===
                          "WEBSITE"


                      return (
                        <button
                          key={
                            service.code
                          }
                          type="button"
                          disabled={
                            !clickable
                          }
                          onClick={() =>
                            handleServiceClick(
                              service
                            )
                          }
                          className={`flex w-full items-center justify-between rounded-2xl border border-[#E5ECEE] bg-[#FBFCFC] p-4 text-left transition ${
                            clickable
                              ? "cursor-pointer hover:border-[#B9DDE1] hover:bg-white hover:shadow-sm"
                              : "cursor-default"
                          }`}
                        >

                          <div>

                            <p className="font-semibold text-[#284750]">
                              {service.name}
                            </p>


                            <p className="mt-1 text-xs text-[#85979D]">
                              {service.code}
                            </p>

                          </div>


                          <div className="flex items-center gap-3">

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                service.status ===
                                "ACTIVE"
                                  ? "bg-[#E7F7F1] text-[#188366]"
                                  : "bg-[#F1F4F5] text-[#71858C]"
                              }`}
                            >
                              {
                                service.status
                              }
                            </span>


                            <ChevronRight
                              className={`h-4 w-4 ${
                                clickable
                                  ? "text-[#7E949B]"
                                  : "text-[#CBD4D7]"
                              }`}
                            />

                          </div>

                        </button>
                      )
                    }
                  )}

                </div>

              </section>


              {/* RIGHT COLUMN */}
              <section className="space-y-5">

                <div className="ez-card p-6">

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E6F8F9]">

                    <Globe2 className="h-5 w-5 text-[#0A9CA9]" />

                  </div>


                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#84969D]">
                    Workspace address
                  </p>


                  <p className="mt-2 break-all text-[15px] font-semibold text-[#22444E]">
                    {
                      workspace.domain
                        ?.hostname ??
                      `${workspace.slug}.ezfotoo.com`
                    }
                  </p>


                  <p className="mt-3 text-xs leading-5 text-[#899A9F]">
                    Your photographer website will be published here when the Website service is activated.
                  </p>

                </div>


                <div className="rounded-[22px] bg-[#073B4C] p-6 text-white">

                  <Camera className="h-6 w-6 text-[#55D9E2]" />


                  <h3 className="mt-4 text-lg font-semibold">
                    Your workspace is ready.
                  </h3>


                  <p className="mt-2 text-sm leading-6 text-[#B8CDD2]">
                    We will build each service step by step while keeping everything under one professional photography brand.
                  </p>

                </div>

              </section>

            </div>

          </div>

        </section>

      </div>

    </main>
  )
}


function StatCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="ez-card p-5">

      <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[#899A9F]">
        {label}
      </p>


      <p className="mt-3 text-xl font-semibold tracking-[-0.025em] text-[#183A44]">
        {value}
      </p>

    </div>
  )
}