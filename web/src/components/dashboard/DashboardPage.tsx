"use client"

import Link from "next/link"
import { ArrowLeft, Camera } from "lucide-react"
import type { ReactNode } from "react"

export const dashboardButtonClass =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#D4E2E5] bg-white px-3 text-sm font-semibold text-[#45666F] transition hover:bg-[#F6FAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47C6CE] disabled:opacity-50"

export const dashboardPrimaryButtonClass =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-4 text-sm font-semibold text-white transition hover:bg-[#0B5363] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47C6CE] focus-visible:ring-offset-2 disabled:opacity-50"

export const dashboardCardClass =
  "rounded-[24px] border border-[#DFE8EA] bg-white shadow-[0_12px_40px_rgba(8,47,60,0.04)]"

export function formatDashboardMoney(cents: number, currency = "MYR") {
  if (currency === "MYR") {
    return `RM ${(cents / 100).toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

export function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${dashboardCardClass} p-6`}>
      <p className="text-sm text-[#70868E]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#123743]">{value}</p>
    </div>
  )
}

type DashboardHeaderProps = {
  title: string
  section?: string
  icon?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  backHref?: string
  backLabel?: string
  titleAsHeading?: boolean
}

export function DashboardHeader({
  title,
  section = "Event Sales",
  icon = <Camera className="h-4 w-4" />,
  actions,
  children,
  backHref = "/dashboard",
  backLabel = "Back to dashboard",
  titleAsHeading = false,
}: DashboardHeaderProps) {
  const Title = titleAsHeading ? "h1" : "p"
  return (
      <header className="sticky top-0 z-30 border-b border-[#DFE8EA] bg-white/95 backdrop-blur">
        <div className="flex min-h-20 flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={backHref} aria-label={backLabel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E1EAEC] bg-white text-[#58717A] transition hover:bg-[#F4F8F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47C6CE]">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#0A8D99]">{icon}{section}</p>
              <Title className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#183A44]">{title}</Title>
            </div>
          </div>
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </header>
  )
}

type DashboardPageProps = {
  title: string
  heading: string
  description: string
  children: ReactNode
  actions?: ReactNode
  summary?: ReactNode
  section?: string
  eyebrow?: string
  icon?: ReactNode
  backHref?: string
  backLabel?: string
}

export default function DashboardPage({
  title, heading, description, children, actions, summary,
  section = "Event Sales",
  eyebrow = "Photography commerce",
  icon = <Camera className="h-4 w-4" />,
  backHref = "/dashboard",
  backLabel = "Back to dashboard",
}: DashboardPageProps) {
  return (
    <div className="min-h-screen bg-[#F5F8F9] text-[#173D47]">
      <DashboardHeader
        title={title}
        section={section}
        icon={icon}
        actions={actions}
        backHref={backHref}
        backLabel={backLabel}
      />
      <main className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">{eyebrow}</p>
            <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#112D38]">{heading}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6D8289]">{description}</p>
          </div>
          {summary && <div className="min-w-0 shrink-0">{summary}</div>}
        </div>
        {children}
      </main>
    </div>
  )
}
