"use client"

import {
  BadgeDollarSign,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react"
import {
  FormEvent,
  useState,
} from "react"

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


type Props = {
  packages: PackageItem[]
  onChange: (
    packages: PackageItem[]
  ) => void
}


export default function PackageManager({
  packages,
  onChange,
}: Props) {
  const [name, setName] = useState("")
  const [description, setDescription] =
    useState("")

  const [price, setPrice] =
    useState("")

  const [priceLabel, setPriceLabel] =
    useState("")

  const [features, setFeatures] =
    useState("")

  const [saving, setSaving] =
    useState(false)

  const [deleting, setDeleting] =
    useState<string | null>(null)

  const [error, setError] =
    useState("")


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError("")
    setSaving(true)

    try {
      const created =
        await apiFetch<PackageItem>(
          "/api/website/packages",
          {
            method: "POST",

            body: JSON.stringify({
              name,

              description:
                description || null,

              price_rm:
                price
                  ? Number(price)
                  : null,

              price_label:
                priceLabel || null,

              features_text:
                features || null,

              sort_order:
                packages.length,

              is_featured:
                packages.length === 0,

              is_visible: true,
            }),
          }
        )

      onChange([
        ...packages,
        created,
      ])

      setName("")
      setDescription("")
      setPrice("")
      setPriceLabel("")
      setFeatures("")

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create package."
      )

    } finally {
      setSaving(false)
    }
  }


  async function deletePackage(
    id: string
  ) {
    setDeleting(id)

    try {
      await apiFetch(
        `/api/website/packages/${id}`,
        {
          method: "DELETE",
        }
      )

      onChange(
        packages.filter(
          (item) =>
            item.id !== id
        )
      )

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete package."
      )

    } finally {
      setDeleting(null)
    }
  }


  return (
    <div className="space-y-8">

      <div>

        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A929F]">
          Packages
        </p>

        <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#173943]">
          Photography services
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#768B92]">
          Present clear photography packages and starting prices to potential clients.
        </p>

      </div>


      {error && (
        <div className="rounded-xl border border-[#F0CDD1] bg-[#FFF7F8] px-4 py-3 text-sm text-[#A6424E]">
          {error}
        </div>
      )}


      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-[#E3EBED] bg-[#FAFCFC] p-5"
      >

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#36535C]">
            Package name
          </label>

          <input
            required
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="Wedding Essentials"
            className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm text-[#203F48] outline-none focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
          />
        </div>


        <div>
          <label className="mb-2 block text-sm font-semibold text-[#36535C]">
            Description
          </label>

          <textarea
            rows={3}
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value
              )
            }
            placeholder="Perfect for intimate weddings and solemnisation..."
            className="w-full resize-none rounded-xl border border-[#DCE6E8] bg-white px-4 py-3 text-sm text-[#203F48] outline-none focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
          />
        </div>


        <div className="grid gap-4 sm:grid-cols-2">

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#36535C]">
              Price (RM)
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) =>
                setPrice(
                  event.target.value
                )
              }
              placeholder="850"
              className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm text-[#203F48] outline-none focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
            />
          </div>


          <div>
            <label className="mb-2 block text-sm font-semibold text-[#36535C]">
              Or price label
            </label>

            <input
              value={priceLabel}
              onChange={(event) =>
                setPriceLabel(
                  event.target.value
                )
              }
              placeholder="From RM850"
              className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm text-[#203F48] outline-none focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
            />
          </div>

        </div>


        <div>
          <label className="mb-2 block text-sm font-semibold text-[#36535C]">
            Package features
          </label>

          <textarea
            rows={5}
            value={features}
            onChange={(event) =>
              setFeatures(
                event.target.value
              )
            }
            placeholder={
              "4 hours photography\n200 edited photos\nOnline gallery\nHigh-resolution downloads"
            }
            className="w-full resize-none rounded-xl border border-[#DCE6E8] bg-white px-4 py-3 text-sm leading-6 text-[#203F48] outline-none focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
          />

          <p className="mt-2 text-xs text-[#899A9F]">
            Put one feature on each line.
          </p>
        </div>


        <button
          type="submit"
          disabled={saving}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:opacity-60"
        >

          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}

          Add package

        </button>

      </form>


      {packages.length === 0 ? (

        <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D6E2E5] bg-[#FAFCFC]">

          <BadgeDollarSign className="h-7 w-7 text-[#9FB0B5]" />

          <p className="mt-4 text-sm font-semibold text-[#607981]">
            No packages yet
          </p>

        </div>

      ) : (

        <div className="space-y-3">

          {packages.map(
            (item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#E1EAEC] bg-white p-5"
              >

                <div className="flex justify-between gap-4">

                  <div>

                    <p className="font-semibold text-[#294A53]">
                      {item.name}
                    </p>

                    {item.description && (
                      <p className="mt-2 text-xs leading-5 text-[#7B8E95]">
                        {item.description}
                      </p>
                    )}

                  </div>


                  <p className="shrink-0 font-semibold text-[#073B4C]">

                    {item.price_rm
                      ? `RM ${item.price_rm}`
                      : item.price_label ||
                        "Contact"}

                  </p>

                </div>


                {item.features_text && (
                  <div className="mt-4 whitespace-pre-line rounded-xl bg-[#F7FAFB] p-4 text-xs leading-6 text-[#6E838A]">
                    {item.features_text}
                  </div>
                )}


                <button
                  type="button"
                  disabled={
                    deleting === item.id
                  }
                  onClick={() =>
                    deletePackage(
                      item.id
                    )
                  }
                  className="mt-4 flex h-9 items-center gap-2 rounded-xl bg-[#FFF5F6] px-3 text-xs font-semibold text-[#A84E58]"
                >

                  {deleting ===
                  item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}

                  Delete

                </button>

              </div>
            )
          )}

        </div>

      )}

    </div>
  )
}