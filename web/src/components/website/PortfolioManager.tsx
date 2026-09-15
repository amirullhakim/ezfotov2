"use client"

import {
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react"
import {
  FormEvent,
  useState,
} from "react"

import { apiFetch } from "@/lib/api"


export type PortfolioItem = {
  id: string
  title: string
  category: string | null
  description?: string | null
  image_url: string
  sort_order?: number
  is_featured?: boolean
  is_visible?: boolean
}


type Props = {
  items: PortfolioItem[]
  onChange: (items: PortfolioItem[]) => void
}


export default function PortfolioManager({
  items,
  onChange,
}: Props) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] =
    useState<string | null>(null)

  const [error, setError] = useState("")


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError("")
    setSaving(true)

    try {
      const created =
        await apiFetch<PortfolioItem>(
          "/api/website/portfolio",
          {
            method: "POST",
            body: JSON.stringify({
              title,
              category:
                category || null,

              description:
                description || null,

              image_url: imageUrl,

              sort_order:
                items.length,

              is_featured:
                items.length === 0,

              is_visible: true,
            }),
          }
        )

      onChange([
        ...items,
        created,
      ])

      setTitle("")
      setCategory("")
      setDescription("")
      setImageUrl("")

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add portfolio item."
      )

    } finally {
      setSaving(false)
    }
  }


  async function deleteItem(
    itemId: string
  ) {
    setDeleting(itemId)
    setError("")

    try {
      await apiFetch(
        `/api/website/portfolio/${itemId}`,
        {
          method: "DELETE",
        }
      )

      onChange(
        items.filter(
          (item) =>
            item.id !== itemId
        )
      )

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete photo."
      )

    } finally {
      setDeleting(null)
    }
  }


  return (
    <div className="space-y-8">

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A929F]">
          Portfolio
        </p>

        <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#173943]">
          Showcase your work
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#768B92]">
          Add selected photography that represents your style
          and the type of work you want customers to see.
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

        <div className="flex items-center gap-2">

          <Plus className="h-4 w-4 text-[#0A99A7]" />

          <p className="font-semibold text-[#2C4C55]">
            Add portfolio photo
          </p>

        </div>


        <div>
          <label className="mb-2 block text-sm font-semibold text-[#36535C]">
            Photo title
          </label>

          <input
            required
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="Wedding in Kuala Lumpur"
            className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm text-[#203F48] outline-none focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
          />
        </div>


        <div>
          <label className="mb-2 block text-sm font-semibold text-[#36535C]">
            Category
          </label>

          <input
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value
              )
            }
            placeholder="Wedding, Portrait, Event..."
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
            placeholder="Optional short description..."
            className="w-full resize-none rounded-xl border border-[#DCE6E8] bg-white px-4 py-3 text-sm text-[#203F48] outline-none focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
          />
        </div>


        <div>
          <label className="mb-2 block text-sm font-semibold text-[#36535C]">
            Image URL
          </label>

          <input
            required
            value={imageUrl}
            onChange={(event) =>
              setImageUrl(
                event.target.value
              )
            }
            placeholder="https://..."
            className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm text-[#203F48] outline-none focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
          />

          <p className="mt-2 text-xs leading-5 text-[#8C9BA0]">
            Temporary during development. R2 direct upload comes next.
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

          Add to portfolio
        </button>

      </form>


      <div>

        <div className="mb-4 flex items-center justify-between">

          <p className="font-semibold text-[#294A53]">
            Portfolio
          </p>

          <span className="rounded-full bg-[#EDF7F8] px-3 py-1 text-xs font-bold text-[#087F8C]">
            {items.length} photos
          </span>

        </div>


        {items.length === 0 ? (

          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D6E2E5] bg-[#FAFCFC] px-5 text-center">

            <ImageIcon className="h-7 w-7 text-[#9FB0B5]" />

            <p className="mt-4 text-sm font-semibold text-[#607981]">
              No portfolio photos yet
            </p>

            <p className="mt-1 max-w-xs text-xs leading-5 text-[#91A1A6]">
              Add your first photograph to start building your public portfolio.
            </p>

          </div>

        ) : (

          <div className="grid gap-4 sm:grid-cols-2">

            {items.map(
              (item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-[#E1EAEC] bg-white"
                >

                  <div className="aspect-[4/3] bg-[#EDF2F3]">

                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />

                  </div>


                  <div className="p-4">

                    <p className="font-semibold text-[#294A53]">
                      {item.title}
                    </p>

                    {item.category && (
                      <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[#899A9F]">
                        {item.category}
                      </p>
                    )}


                    <button
                      onClick={() =>
                        deleteItem(
                          item.id
                        )
                      }
                      disabled={
                        deleting === item.id
                      }
                      type="button"
                      className="mt-4 flex h-9 items-center gap-2 rounded-xl bg-[#FFF5F6] px-3 text-xs font-semibold text-[#A84E58] transition hover:bg-[#FDEBED]"
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

                </div>
              )
            )}

          </div>

        )}

      </div>

    </div>
  )
}