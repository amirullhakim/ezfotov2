"use client"

import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"

import { apiFetch } from "@/lib/api"


type AccountResponse = {
  is_platform_admin: boolean
}


export default function PlatformAdminAccess() {
  const [isPlatformAdmin, setIsPlatformAdmin] =
    useState(false)

  useEffect(() => {
    let active = true

    async function loadAccount() {
      try {
        const account = await apiFetch<AccountResponse>(
          "/api/auth/me"
        )

        if (active) {
          setIsPlatformAdmin(
            account.is_platform_admin === true
          )
        }
      } catch {
        if (active) {
          setIsPlatformAdmin(false)
        }
      }
    }

    void loadAccount()

    return () => {
      active = false
    }
  }, [])

  if (!isPlatformAdmin) return null

  return (
    <nav
      aria-label="Platform administration"
      className="border-b border-[#D8ECEF] bg-[#EDF9FA]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 lg:px-9">
        <span className="text-xs font-medium text-[#557780]">
          Your workspace
        </span>

        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#087F8C] transition hover:bg-[#DDF1F3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087F8C]"
        >
          <ShieldCheck className="h-4 w-4" />
          Platform Admin
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </nav>
  )
}