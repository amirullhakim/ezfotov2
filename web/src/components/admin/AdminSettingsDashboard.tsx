"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { Loader2, Settings, ShieldCheck } from "lucide-react"
import DashboardPage, { dashboardCardClass, dashboardPrimaryButtonClass, dashboardButtonClass } from "@/components/dashboard/DashboardPage"
import { apiFetch } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"

type AdminProfile = { full_name: string; email: string; role: string }
type Notice = { section: "profile" | "password"; message: string; error: boolean }
const inputClass = "mt-2 h-11 w-full rounded-xl border border-[#D4E2E5] bg-white px-3 text-sm text-[#173640] outline-none focus:border-[#0A929F] focus:ring-2 focus:ring-[#47C6CE]/20 disabled:bg-[#F6F9FA]"

export default function AdminSettingsDashboard() {
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [nonce, setNonce] = useState("")
  const [needsNonce, setNeedsNonce] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError("")
    apiFetch<AdminProfile>("/api/admin/settings", { cache: "no-store" })
      .then((result) => {
        if (active) { setProfile(result); setFullName(result.full_name) }
      })
      .catch((cause: unknown) => { if (active) setLoadError(cause instanceof Error ? cause.message : "Unable to load admin settings.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])

  function result(section: Notice["section"], message: string, error = false) {
    setNotice({ section, message, error })
  }
  function feedback(section: Notice["section"]) {
    if (notice?.section !== section) return null
    return <p role={notice.error ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${notice.error ? "bg-[#FFF6F7] text-[#A44D57]" : "bg-[#E7F8F3] text-[#16856F]"}`}>{notice.message}</p>
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy("profile")
    setNotice(null)
    try {
      const data = await apiFetch<AdminProfile>("/api/admin/settings/profile", { method: "PATCH", body: JSON.stringify({ full_name: fullName }) })
      setProfile(data)
      setFullName(data.full_name)
      result("profile", "Your profile has been updated.")
    } catch (cause) {
      result("profile", cause instanceof Error ? cause.message : "Unable to save your profile.", true)
    } finally { setBusy(null) }
  }
  async function sendCode() {
    if (busy) return
    setBusy("code")
    try {
      const { error } = await createClient().auth.reauthenticate()
      if (error) throw error
      setNeedsNonce(true)
      result("password", "A verification code has been sent to your account email. Enter it below and submit again.")
    } catch (cause) {
      result("password", cause instanceof Error ? cause.message : "Unable to send the verification code.", true)
    } finally { setBusy(null) }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (password !== confirmation) return result("password", "The new passwords do not match.", true)
    if (password === currentPassword) return result("password", "Choose a password different from your current password.", true)
    setBusy("password")
    setNotice(null)
    try {
      const { error } = await createClient().auth.updateUser({ password, current_password: currentPassword, ...(nonce.trim() ? { nonce: nonce.trim() } : {}) })
      if (error) {
        if (error.code === "reauthentication_needed" || /reauthentication/i.test(error.message)) setNeedsNonce(true)
        throw error
      }
      setCurrentPassword(""); setPassword(""); setConfirmation(""); setNonce(""); setNeedsNonce(false)
      result("password", "Your password has been changed. Use the new password the next time you sign in.")
    } catch (cause) {
      result("password", cause instanceof Error ? cause.message : "Unable to change your password.", true)
    } finally { setBusy(null) }
  }
  const disabled = busy !== null
  return (
    <DashboardPage title="Settings" section="Platform Admin" icon={<Settings className="h-4 w-4" />} eyebrow="Super admin" heading="Account settings" description="Manage your admin profile and account security." backHref="/admin" backLabel="Back to platform overview" actions={<Link href="/dashboard" className={dashboardButtonClass}>My workspace</Link>}>
      {loading ? <p role="status" className="flex items-center gap-2 text-sm text-[#6A7E86]"><Loader2 className="h-5 w-5 animate-spin" /> Loading admin settings...</p> : loadError ? (
        <div className={`${dashboardCardClass} p-6`}><p role="alert" className="text-sm text-[#A44D57]">{loadError}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className={`${dashboardPrimaryButtonClass} mt-4`}>Try again</button></div>
      ) : profile ? (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <section className={`${dashboardCardClass} p-6 lg:p-7`}>
            <h2 className="text-lg font-semibold text-[#163741]">Admin profile</h2>
            <p className="mt-2 text-sm leading-6 text-[#6A7E86]">Your details as the EZFOTOO platform administrator.</p>
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#F0F9FA] p-3 text-sm font-semibold text-[#087F8C]"><ShieldCheck className="h-4 w-4" />Super Admin</div>
            <form className="mt-5 space-y-4" onSubmit={(event) => void saveProfile(event)}>
              <label className="block text-sm font-semibold text-[#45666F]">Full name<input className={inputClass} value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={255} autoComplete="name" disabled={disabled} /></label>
              <label className="block text-sm font-semibold text-[#45666F]">Email address<input className={inputClass} value={profile.email} type="email" autoComplete="email" readOnly /></label>
              <button type="submit" disabled={disabled} className={dashboardPrimaryButtonClass}>{busy === "profile" ? "Saving..." : "Save profile"}</button>
              {feedback("profile")}
            </form>
          </section>
          <section className={`${dashboardCardClass} p-6 lg:p-7`}>
            <h2 className="text-lg font-semibold text-[#163741]">Password</h2>
            <p className="mt-2 text-sm leading-6 text-[#6A7E86]">Confirm your current password and choose a new one.</p>
            <form className="mt-5 space-y-4" onSubmit={(event) => void changePassword(event)}>
              <label className="block text-sm font-semibold text-[#45666F]">Current password<input className={inputClass} type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required maxLength={256} autoComplete="current-password" disabled={disabled} /></label>
              <label className="block text-sm font-semibold text-[#45666F]">New password<input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={256} autoComplete="new-password" disabled={disabled} /></label>
              <label className="block text-sm font-semibold text-[#45666F]">Confirm new password<input className={inputClass} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} maxLength={256} autoComplete="new-password" disabled={disabled} /></label>
              {needsNonce && <div className="space-y-3 rounded-xl bg-[#F3F9FA] p-4"><p className="text-sm text-[#45666F]">Verify your account before changing your password.</p><button type="button" onClick={() => void sendCode()} disabled={disabled} className="text-sm font-semibold text-[#0A929F]">{busy === "code" ? "Sending..." : "Send verification code"}</button><label className="block text-sm font-semibold text-[#45666F]">Verification code<input className={inputClass} value={nonce} onChange={(event) => setNonce(event.target.value)} autoComplete="one-time-code" inputMode="numeric" maxLength={20} disabled={disabled} /></label></div>}
              <button type="submit" disabled={disabled} className={dashboardPrimaryButtonClass}><ShieldCheck className="h-4 w-4" />{busy === "password" ? "Updating..." : "Change password"}</button>
              {feedback("password")}
            </form>
          </section>
        </div>
      ) : null}
    </DashboardPage>
  )
}
