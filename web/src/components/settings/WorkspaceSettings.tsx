"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Settings, ShieldCheck } from "lucide-react"
import DashboardPage, { dashboardCardClass, dashboardPrimaryButtonClass } from "@/components/dashboard/DashboardPage"
import WorkspacePlanSummary from "@/components/billing/WorkspacePlanSummary"
import { apiFetch } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"

type SettingsSnapshot = {
  profile: { full_name: string; email: string }
  workspace: {
    name: string; business_name: string; slug: string; hostname: string
    root_domain: string; domain_verified: boolean; role: string
  }
  can_manage_workspace: boolean
}
type Availability = { available: boolean; reason: string | null; hostname: string }
type Notice = { section: string; message: string; error: boolean }
const inputClass = "mt-2 h-11 w-full rounded-xl border border-[#D4E2E5] bg-white px-3 text-sm text-[#173640] outline-none focus:border-[#0A929F] focus:ring-2 focus:ring-[#47C6CE]/20 disabled:bg-[#F6F9FA] disabled:text-[#81949B]"

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className={`${dashboardCardClass} p-6 lg:p-7`}><h2 className="text-lg font-semibold text-[#163741]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#6A7E86]">{description}</p><div className="mt-5">{children}</div></section>
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold text-[#45666F]">{label}{children}</label>
}

export default function WorkspaceSettings() {
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [retry, setRetry] = useState(0)
  const [fullName, setFullName] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [slug, setSlug] = useState("")
  const [addressConfirmed, setAddressConfirmed] = useState(false)
  const [availability, setAvailability] = useState<Availability | null>(null)
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
    apiFetch<SettingsSnapshot>("/api/workspaces/me/settings", { cache: "no-store" })
      .then((data) => {
        if (!active) return
        setSnapshot(data)
        setFullName(data.profile.full_name)
        setWorkspaceName(data.workspace.name)
        setBusinessName(data.workspace.business_name)
        setSlug(data.workspace.slug)
      })
      .catch((cause: unknown) => { if (active) setLoadError(cause instanceof Error ? cause.message : "Unable to load settings.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])

  function result(section: string, message: string, error = false) {
    setNotice({ section, message, error })
  }
  function feedback(section: string) {
    if (notice?.section !== section) return null
    return <p role={notice.error ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${notice.error ? "bg-[#FFF6F7] text-[#A44D57]" : "bg-[#E7F8F3] text-[#16856F]"}`}>{notice.message}</p>
  }
  async function save(section: string, path: string, body: object) {
    if (busy) return
    setBusy(section)
    setNotice(null)
    try {
      const data = await apiFetch<SettingsSnapshot>(path, { method: "PATCH", body: JSON.stringify(body) })
      setSnapshot(data)
      if (section === "profile") setFullName(data.profile.full_name)
      if (section === "workspace") {
        setWorkspaceName(data.workspace.name)
        setBusinessName(data.workspace.business_name)
      }
      if (section === "address") {
        setSlug(data.workspace.slug)
        setAddressConfirmed(false)
        setAvailability(null)
      }
      result(section, section === "address" ? "Your workspace address has been updated." : "Changes saved.")
      router.refresh()
    } catch (cause) {
      result(section, cause instanceof Error ? cause.message : "Unable to save changes.", true)
    } finally { setBusy(null) }
  }
  async function checkAddress() {
    if (busy || !snapshot) return
    setBusy("availability")
    setNotice(null)
    setAvailability(null)
    try {
      const normalized = slug.trim().toLowerCase()
      if (normalized === snapshot.workspace.slug) {
        setAvailability({ available: true, reason: "This is your current address.", hostname: snapshot.workspace.hostname })
      } else {
        const data = await apiFetch<Availability>(`/api/workspaces/me/address/${encodeURIComponent(normalized)}`, { cache: "no-store" })
        setAvailability(data)
      }
    } catch (cause) {
      result("address", cause instanceof Error ? cause.message : "Unable to check the address.", true)
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
      const { error } = await createClient().auth.updateUser({
        password,
        current_password: currentPassword,
        ...(nonce.trim() ? { nonce: nonce.trim() } : {}),
      })
      if (error) {
        if (error.code === "reauthentication_needed" || /reauthentication/i.test(error.message)) setNeedsNonce(true)
        throw error
      }
      setCurrentPassword("")
      setPassword("")
      setConfirmation("")
      setNonce("")
      setNeedsNonce(false)
      result("password", "Your password has been changed. Use the new password the next time you sign in.")
    } catch (cause) {
      result("password", cause instanceof Error ? cause.message : "Unable to change the password.", true)
    } finally { setBusy(null) }
  }

  const disabled = busy !== null
  const canManage = snapshot?.can_manage_workspace === true
  const addressChanged = !!snapshot && slug.trim().toLowerCase() !== snapshot.workspace.slug
  return (
    <DashboardPage title="Settings" section="Workspace" icon={<Settings className="h-4 w-4" />} eyebrow="Your workspace" heading="Account and settings" description="Manage your profile, business details and account security.">
      {loading ? <p className="flex items-center gap-2 text-sm text-[#6A7E86]" role="status"><Loader2 className="h-5 w-5 animate-spin" /> Loading settings...</p> : loadError ? (
        <div className={`${dashboardCardClass} p-6`}><p role="alert" className="text-sm text-[#A44D57]">{loadError}</p><button type="button" className={`${dashboardPrimaryButtonClass} mt-4`} onClick={() => setRetry((value) => value + 1)}>Try again</button></div>
      ) : snapshot ? (
        <div className="space-y-6">
          <WorkspacePlanSummary />
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Card title="Your profile" description="Your account details. Your sign-in email stays the same.">
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save("profile", "/api/workspaces/me/profile", { full_name: fullName }) }}>
                <Field label="Full name"><input className={inputClass} value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={255} autoComplete="name" required disabled={disabled} /></Field>
                <Field label="Email address"><input className={inputClass} value={snapshot.profile.email} type="email" autoComplete="email" readOnly /></Field>
                <button className={dashboardPrimaryButtonClass} disabled={disabled} type="submit">{busy === "profile" ? "Saving..." : "Save profile"}</button>
                {feedback("profile")}
              </form>
            </Card>
            <Card title="Business details" description="The names used for your workspace and photography business.">
              {!canManage && <p className="mb-4 text-sm text-[#81949B]">Only the workspace owner can change business details.</p>}
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save("workspace", "/api/workspaces/me/settings", { name: workspaceName, business_name: businessName }) }}>
                <Field label="Workspace name"><input className={inputClass} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} required minLength={2} maxLength={255} disabled={disabled || !canManage} /></Field>
                <Field label="Business name"><input className={inputClass} value={businessName} onChange={(event) => setBusinessName(event.target.value)} required minLength={2} maxLength={255} autoComplete="organization" disabled={disabled || !canManage} /></Field>
                <button className={dashboardPrimaryButtonClass} type="submit" disabled={disabled || !canManage}>{busy === "workspace" ? "Saving..." : "Save business details"}</button>
                {feedback("workspace")}
              </form>
            </Card>
            <Card title="Workspace address" description="Your photographer website address on EZFOTOO.">
              <p className="mb-4 break-all rounded-xl bg-[#F3F9FA] p-3 text-sm font-semibold text-[#284750]">{snapshot.workspace.hostname}</p>
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save("address", "/api/workspaces/me/address", { slug, confirm_link_change: addressConfirmed }) }}>
                <Field label="Address"><div className="flex items-center gap-2"><input className={`${inputClass} min-w-0`} value={slug} onChange={(event) => { setSlug(event.target.value.toLowerCase()); setAvailability(null); setAddressConfirmed(false) }} minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" spellCheck={false} required disabled={disabled || !canManage} /><span className="mt-2 shrink-0 text-xs font-normal text-[#81949B]">.{snapshot.workspace.root_domain}</span></div></Field>
                <button type="button" onClick={() => void checkAddress()} disabled={disabled || !canManage || !slug.trim()} className="text-sm font-semibold text-[#0A929F] disabled:opacity-50">{busy === "availability" ? "Checking..." : "Check availability"}</button>
                {availability && <p role="status" className={`text-sm ${availability.available ? "text-[#16856F]" : "text-[#A44D57]"}`}>{availability.reason || (availability.available ? "This address is available." : "This address is unavailable.")}</p>}
                <p className="text-xs leading-5 text-[#81949B]">Changing your address changes your website, event and gallery links. Update links you have already shared. Your photos, orders and subscriptions remain in the same workspace.</p>
                {addressChanged && <label className="flex items-start gap-3 text-sm leading-5 text-[#45666F]"><input type="checkbox" className="mt-1 accent-[#087F8C]" checked={addressConfirmed} onChange={(event) => setAddressConfirmed(event.target.checked)} required disabled={disabled || !canManage} />I understand that previously shared links will need updating.</label>}
                <button type="submit" className={dashboardPrimaryButtonClass} disabled={disabled || !canManage || !addressChanged || !addressConfirmed || availability?.available === false}>{busy === "address" ? "Connecting address..." : "Update address"}</button>
                {feedback("address")}
              </form>
            </Card>
            <Card title="Password" description="Confirm your current password and choose a new one.">
              <form className="space-y-4" onSubmit={(event) => void changePassword(event)}>
                <Field label="Current password"><input type="password" className={inputClass} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required maxLength={256} disabled={disabled} /></Field>
                <Field label="New password"><input type="password" className={inputClass} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={256} disabled={disabled} /></Field>
                <Field label="Confirm new password"><input type="password" className={inputClass} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} maxLength={256} disabled={disabled} /></Field>
                {needsNonce && <div className="space-y-3 rounded-xl bg-[#F3F9FA] p-4"><p className="text-sm text-[#45666F]">Verify your account before changing your password.</p><button type="button" onClick={() => void sendCode()} disabled={disabled} className="text-sm font-semibold text-[#0A929F]">{busy === "code" ? "Sending..." : "Send verification code"}</button><Field label="Verification code"><input className={inputClass} value={nonce} onChange={(event) => setNonce(event.target.value)} autoComplete="one-time-code" inputMode="numeric" maxLength={20} disabled={disabled} /></Field></div>}
                <button type="submit" className={dashboardPrimaryButtonClass} disabled={disabled}><ShieldCheck className="h-4 w-4" />{busy === "password" ? "Updating..." : "Change password"}</button>
                {feedback("password")}
              </form>
            </Card>
          </div>
        </div>
      ) : null}
    </DashboardPage>
  )
}
