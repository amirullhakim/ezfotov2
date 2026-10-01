"use client"

import { BadgeDollarSign, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { type FormEvent, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"

export type PackageItem = {
  id: string
  name: string
  description: string | null
  price_rm: string | null
  price_label: string | null
  features_text: string | null
  sort_order?: number
  is_featured?: boolean
  is_visible?: boolean
}

type Props = { packages: PackageItem[]; onChange: (packages: PackageItem[]) => void }
type PackageResponse = { packages: PackageItem[]; can_manage_prices: boolean }
const inputClass = "w-full rounded-xl border border-[#DCE6E8] bg-white px-4 py-3 text-sm text-[#203F48] outline-none focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10 disabled:bg-[#F0F4F5] disabled:text-[#80949B]"

function priceText(item: PackageItem) {
  if (item.price_label && /\bRM\s*\d/i.test(item.price_label)) return item.price_label
  if (item.price_rm !== null) {
    const amount = Number(item.price_rm)
    if (Number.isFinite(amount)) {
      return `RM ${amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${item.price_label ? ` ${item.price_label}` : ""}`
    }
  }
  return item.price_label || "Contact for pricing"
}

export default function PackageManager({ packages, onChange }: Props) {
  const [editing, setEditing] = useState<PackageItem | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [priceLabel, setPriceLabel] = useState("")
  const [features, setFeatures] = useState("")
  const [visible, setVisible] = useState(true)
  const [featured, setFeatured] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [canManagePrices, setCanManagePrices] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const busy = saving || deleting !== null

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const result = await apiFetch<PackageResponse>("/api/website/packages")
        if (active) {
          setCanManagePrices(result.can_manage_prices)
          onChange(result.packages)
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to check package pricing access.")
      } finally {
        if (active) setCheckingAccess(false)
      }
    }
    void load()
    return () => { active = false }
  }, [onChange])

  function resetForm() {
    setEditing(null)
    setName("")
    setDescription("")
    setPrice("")
    setPriceLabel("")
    setFeatures("")
    setVisible(true)
    setFeatured(false)
  }

  function editPackage(item: PackageItem) {
    setEditing(item)
    setName(item.name)
    setDescription(item.description ?? "")
    setPrice(item.price_rm === null ? "" : String(item.price_rm))
    setPriceLabel(item.price_label ?? "")
    setFeatures(item.features_text ?? "")
    setVisible(item.is_visible ?? true)
    setFeatured(item.is_featured ?? false)
    setError("")
    setSuccess("")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || checkingAccess) return
    setError("")
    setSuccess("")
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        features_text: features.trim() || null,
        is_visible: visible,
        is_featured: featured || (!editing && packages.length === 0),
      }
      if (canManagePrices) {
        // Send decimal text to avoid changing money through floating point.
        payload.price_rm = price.trim() || null
        payload.price_label = priceLabel.trim() || null
      }
      if (!editing) payload.sort_order = Math.max(-1, ...packages.map(item => item.sort_order ?? 0)) + 1
      const result = await apiFetch<PackageItem>(
        editing ? `/api/website/packages/${encodeURIComponent(editing.id)}` : "/api/website/packages",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) }
      )
      onChange(editing ? packages.map(item => item.id === result.id ? result : item) : [...packages, result])
      setSuccess(editing ? "Package updated." : "Package added.")
      resetForm()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save package.")
      // Refresh eligibility if a subscription expired while this page was open.
      try {
        const access = await apiFetch<PackageResponse>("/api/website/packages")
        setCanManagePrices(access.can_manage_prices)
      } catch { /* Keep the save error visible. The backend still enforces access. */ }
    } finally {
      setSaving(false)
    }
  }

  async function deletePackage(id: string) {
    if (busy) return
    setDeleting(id)
    setError("")
    setSuccess("")
    try {
      await apiFetch(`/api/website/packages/${encodeURIComponent(id)}`, { method: "DELETE" })
      onChange(packages.filter(item => item.id !== id))
      if (editing?.id === id) resetForm()
      setSuccess("Package deleted.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete package.")
    } finally { setDeleting(null) }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A929F]">Packages</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#173943]">Photography services</h2>
        <p className="mt-2 text-sm leading-6 text-[#768B92]">Present your packages and let clients enquire through WhatsApp.</p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-[#F0CDD1] bg-[#FFF7F8] px-4 py-3 text-sm text-[#A6424E]">{error}</div>}
      {success && <p role="status" className="text-sm font-semibold text-[#087F8C]">{success}</p>}
      {!checkingAccess && !canManagePrices && (
        <div className="rounded-2xl border border-[#DCE8EB] bg-[#F3F8F9] p-4 text-sm leading-6 text-[#526F77]">
          Activate Client Gallery to set and publish package prices. You can still edit package details.
          {" "}<Link href="/dashboard/billing" className="font-semibold text-[#087F8C] underline">View plans</Link>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-[#E3EBED] bg-[#FAFCFC] p-5">
        <h3 className="font-semibold text-[#173943]">{editing ? "Edit package" : "Add a package"}</h3>
        <fieldset disabled={busy} className="space-y-5">
          <div>
            <label htmlFor="package-name" className="mb-2 block text-sm font-semibold text-[#36535C]">Package name</label>
            <input id="package-name" required maxLength={255} value={name} onChange={e => setName(e.target.value)} placeholder="Wedding Essentials" className={inputClass} />
          </div>
          <div>
            <label htmlFor="package-description" className="mb-2 block text-sm font-semibold text-[#36535C]">Description</label>
            <textarea id="package-description" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Photography coverage for your special day." className={`${inputClass} resize-none`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="package-price" className="mb-2 block text-sm font-semibold text-[#36535C]">Price (RM)</label>
              <input id="package-price" type="number" min="0" max="99999999.99" step="0.01" value={price} disabled={!canManagePrices || checkingAccess} onChange={e => setPrice(e.target.value)} placeholder="100.00" className={inputClass} />
            </div>
            <div>
              <label htmlFor="package-price-label" className="mb-2 block text-sm font-semibold text-[#36535C]">Price label</label>
              <input id="package-price-label" maxLength={100} value={priceLabel} disabled={!canManagePrices || checkingAccess} onChange={e => setPriceLabel(e.target.value)} placeholder="per hour" className={inputClass} />
            </div>
          </div>
          <p className="text-xs leading-5 text-[#899A9F]">Example: RM100.00 per hour. Leave both fields blank for enquiries without a displayed price.</p>
          <div>
            <label htmlFor="package-features" className="mb-2 block text-sm font-semibold text-[#36535C]">Package features</label>
            <textarea id="package-features" rows={5} value={features} onChange={e => setFeatures(e.target.value)} placeholder={"Photography coverage\nEdited photos\nOnline gallery"} className={`${inputClass} resize-none leading-6`} />
            <p className="mt-2 text-xs text-[#899A9F]">Put one feature on each line.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-[#526F77]">
            <label className="flex items-center gap-2"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />Show on website</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} />Featured package</label>
          </div>
        </fieldset>
        <div className="flex gap-3">
          <button type="submit" disabled={busy || checkingAccess} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-4 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing ? "Save changes" : "Add package"}
          </button>
          {editing && <button type="button" disabled={busy} onClick={resetForm} className="rounded-xl border border-[#DCE6E8] px-4 text-sm font-semibold text-[#526F77]">Cancel</button>}
        </div>
      </form>
      {packages.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D6E2E5] bg-[#FAFCFC]">
          <BadgeDollarSign className="h-7 w-7 text-[#9FB0B5]" /><p className="mt-4 text-sm font-semibold text-[#607981]">No packages yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map(item => (
            <article key={item.id} className="rounded-2xl border border-[#E1EAEC] bg-white p-5">
              <div className="flex flex-wrap justify-between gap-4">
                <div><h3 className="font-semibold text-[#294A53]">{item.name}</h3>{item.description && <p className="mt-2 text-xs leading-5 text-[#7B8E95]">{item.description}</p>}</div>
                <p className="font-semibold text-[#073B4C]">{priceText(item)}</p>
              </div>
              {item.is_visible === false && <p className="mt-2 text-xs text-[#7B8E95]">Hidden from website</p>}
              {item.features_text && <div className="mt-4 whitespace-pre-line rounded-xl bg-[#F7FAFB] p-4 text-xs leading-6 text-[#6E838A]">{item.features_text}</div>}
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={busy} onClick={() => editPackage(item)} className="flex h-9 items-center gap-2 rounded-xl border border-[#DCE6E8] px-3 text-xs font-semibold text-[#526F77]"><Pencil className="h-3.5 w-3.5" />Edit</button>
                <button type="button" disabled={busy} onClick={() => deletePackage(item.id)} className="flex h-9 items-center gap-2 rounded-xl bg-[#FFF5F6] px-3 text-xs font-semibold text-[#A84E58]">
                  {deleting === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
