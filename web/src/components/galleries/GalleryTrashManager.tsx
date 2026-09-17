"use client"

import {
  ArrowLeft,
  CalendarClock,
  HardDrive,
  Images,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react"

import { useRouter } from "next/navigation"

import {
  useEffect,
  useMemo,
  useState,
} from "react"

import { apiFetch } from "@/lib/api"


type PrivacyMode =
  | "PUBLIC"
  | "PRIVATE"
  | "PASSWORD"


type TrashGallery = {
  id: string
  title: string
  slug: string
  client_name: string | null
  privacy_mode: PrivacyMode
  was_published: boolean
  photo_count: number
  storage_bytes: number
  deleted_at: string
  recoverable_until: string
  recovery_available: boolean
}


type TrashResponse = {
  retention_days: number
  galleries: TrashGallery[]
}


export default function GalleryTrashManager() {
  const router = useRouter()

  const [
    galleries,
    setGalleries,
  ] = useState<TrashGallery[]>([])

  const [
    retentionDays,
    setRetentionDays,
  ] = useState(30)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    restoringId,
    setRestoringId,
  ] = useState<string | null>(null)

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(null)

  const [
    statusMessage,
    setStatusMessage,
  ] = useState("")

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("")


  useEffect(() => {
    loadTrash()
  }, [])


  const totalPhotos =
    useMemo(
      () =>
        galleries.reduce(
          (
            total,
            gallery
          ) =>
            total +
            gallery.photo_count,
          0
        ),
      [galleries]
    )


  const totalStorage =
    useMemo(
      () =>
        galleries.reduce(
          (
            total,
            gallery
          ) =>
            total +
            gallery.storage_bytes,
          0
        ),
      [galleries]
    )


  async function loadTrash() {
    setLoading(true)
    setErrorMessage("")

    try {
      const result =
        await apiFetch<TrashResponse>(
          "/api/galleries/trash/items"
        )

      setGalleries(
        result.galleries
      )

      setRetentionDays(
        result.retention_days
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Trash."
      )

    } finally {
      setLoading(false)
    }
  }


  async function restoreGallery(
    gallery: TrashGallery
  ) {
    if (
      !gallery.recovery_available
    ) {
      setErrorMessage(
        "This gallery's recovery period has expired."
      )

      return
    }

    setRestoringId(
      gallery.id
    )

    setErrorMessage("")
    setStatusMessage("")

    try {
      await apiFetch(
        `/api/galleries/trash/${gallery.id}/restore`,
        {
          method: "POST",
        }
      )

      setGalleries(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              gallery.id
          )
      )

      setStatusMessage(
        `"${gallery.title}" was restored.`
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to restore gallery."
      )

    } finally {
      setRestoringId(null)
    }
  }


  async function permanentlyDeleteGallery(
    gallery: TrashGallery
  ) {
    const confirmation =
      window.prompt(
        `Permanently delete "${gallery.title}"?\n\nThis deletes the gallery, its photo records, favourites and private R2 files. This cannot be undone.\n\nType DELETE to continue.`
      )

    if (
      confirmation !== "DELETE"
    ) {
      return
    }

    setDeletingId(
      gallery.id
    )

    setErrorMessage("")
    setStatusMessage("")

    try {
      await apiFetch(
        `/api/galleries/trash/${gallery.id}/permanent`,
        {
          method: "DELETE",
        }
      )

      setGalleries(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              gallery.id
          )
      )

      setStatusMessage(
        `"${gallery.title}" was permanently deleted.`
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to permanently delete gallery."
      )

    } finally {
      setDeletingId(null)
    }
  }


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F9FA]">
        <div className="flex items-center gap-3 text-sm font-semibold text-[#58717A]">
          <Loader2 className="h-5 w-5 animate-spin text-[#0BA5B4]" />
          Loading Trash...
        </div>
      </div>
    )
  }


  return (
    <main className="min-h-screen bg-[#F5F8F9]">

      <header className="sticky top-0 z-30 border-b border-[#DFE8EA] bg-white/95 backdrop-blur">

        <div className="flex min-h-[76px] items-center justify-between gap-5 px-5 lg:px-8">

          <div className="flex items-center gap-4">

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/galleries"
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E1EAEC] bg-white text-[#58717A] transition hover:bg-[#F4F8F9]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>


            <div>
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-[#0A99A7]" />

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0A8D99]">
                  Client Gallery
                </p>
              </div>

              <h1 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#183A44]">
                Trash
              </h1>
            </div>

          </div>


          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard/galleries"
              )
            }
            className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm font-semibold text-[#526D75] transition hover:bg-[#F5F8F9]"
          >
            Back to galleries
          </button>

        </div>

      </header>


      <div className="mx-auto max-w-[1280px] px-5 py-8 lg:px-8 lg:py-10">

        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">
              Recovery
            </p>

            <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#112D38]">
              Deleted galleries
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6D8289]">
              Galleries remain recoverable for up to {retentionDays} days. Moving a gallery to Trash does not delete its private photographs or favourites.
            </p>
          </div>


          <div className="flex flex-wrap gap-3">
            <MiniStat
              label="Trash"
              value={
                galleries.length.toString()
              }
            />

            <MiniStat
              label="Photos"
              value={
                totalPhotos.toString()
              }
            />

            <MiniStat
              label="Storage"
              value={
                formatBytes(
                  totalStorage
                )
              }
            />
          </div>

        </div>


        <div className="mt-7 rounded-2xl border border-[#D9E7EA] bg-[#F3F9FA] px-5 py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#0A929F]" />

            <div>
              <p className="text-sm font-semibold text-[#31545D]">
                Trash is recoverable. Permanent deletion is not.
              </p>

              <p className="mt-1 text-xs leading-5 text-[#72888F]">
                Restore returns the gallery with its existing photos, favourites, privacy settings and publish state. Permanent deletion removes the private R2 files and database records.
              </p>
            </div>
          </div>
        </div>


        {(errorMessage ||
          statusMessage) && (

          <div
            className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
              errorMessage
                ? "border-[#F1D9DD] bg-[#FFF7F8] text-[#A54C58]"
                : "border-[#CEE8E2] bg-[#F1FAF7] text-[#267B64]"
            }`}
          >
            {errorMessage ||
              statusMessage}
          </div>

        )}


        {galleries.length === 0 ? (

          <div className="mt-8 flex min-h-[430px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#CFDDE0] bg-white px-6 text-center">

            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#EAF8F9]">
              <Trash2 className="h-7 w-7 text-[#0A9EAB]" />
            </div>

            <h3 className="mt-6 text-xl font-semibold tracking-[-0.025em] text-[#173943]">
              Trash is empty
            </h3>

            <p className="mt-2 max-w-md text-sm leading-6 text-[#778C93]">
              Galleries you move to Trash will appear here during their recovery period.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/galleries"
                )
              }
              className="mt-6 flex h-11 items-center gap-2 rounded-xl bg-[#073B4C] px-5 text-sm font-semibold text-white transition hover:bg-[#0B5363]"
            >
              Back to galleries
            </button>

          </div>

        ) : (

          <div className="mt-8 space-y-4">

            {galleries.map(
              (gallery) => {
                const restoring =
                  restoringId ===
                  gallery.id

                const deleting =
                  deletingId ===
                  gallery.id

                const busy =
                  restoring ||
                  deleting

                const daysLeft =
                  getDaysRemaining(
                    gallery.recoverable_until
                  )

                return (
                  <article
                    key={
                      gallery.id
                    }
                    className="rounded-[24px] border border-[#DFE8EA] bg-white p-5 shadow-[0_12px_35px_rgba(20,55,65,0.04)] sm:p-6"
                  >

                    <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="rounded-full bg-[#F2F5F6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6E838A]">
                            {getPrivacyLabel(
                              gallery.privacy_mode
                            )}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                              gallery.recovery_available
                                ? "bg-[#E8F7F2] text-[#1E7D64]"
                                : "bg-[#FFF0F1] text-[#A34F59]"
                            }`}
                          >
                            {gallery.recovery_available
                              ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`
                              : "Recovery expired"}
                          </span>

                          {gallery.was_published && (
                            <span className="rounded-full bg-[#EAF5F7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#3D727C]">
                              Was published
                            </span>
                          )}

                        </div>


                        <h3 className="mt-4 truncate text-xl font-semibold tracking-[-0.025em] text-[#173943]">
                          {gallery.title}
                        </h3>

                        <p className="mt-1 text-sm text-[#7A8F96]">
                          {gallery.client_name ||
                            "No client name"}
                        </p>


                        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-xs text-[#6F858C]">

                          <span className="flex items-center gap-1.5">
                            <Images className="h-3.5 w-3.5" />
                            {gallery.photo_count}{" "}
                            {gallery.photo_count === 1
                              ? "photo"
                              : "photos"}
                          </span>

                          <span className="flex items-center gap-1.5">
                            <HardDrive className="h-3.5 w-3.5" />
                            {formatBytes(
                              gallery.storage_bytes
                            )}
                          </span>

                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" />
                            Deleted {formatDateTime(
                              gallery.deleted_at
                            )}
                          </span>

                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" />
                            Recoverable until {formatDateTime(
                              gallery.recoverable_until
                            )}
                          </span>

                        </div>

                      </div>


                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">

                        <button
                          type="button"
                          disabled={
                            busy ||
                            !gallery.recovery_available
                          }
                          onClick={() =>
                            restoreGallery(
                              gallery
                            )
                          }
                          className="flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-4 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {restoring ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}

                          {restoring
                            ? "Restoring..."
                            : "Restore gallery"}
                        </button>


                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            permanentlyDeleteGallery(
                              gallery
                            )
                          }
                          className="flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-xl border border-[#F0D4D9] bg-[#FFF8F8] px-4 text-sm font-semibold text-[#A24D58] transition hover:bg-[#FFF1F3] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {deleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}

                          {deleting
                            ? "Deleting..."
                            : "Delete permanently"}
                        </button>

                      </div>

                    </div>

                  </article>
                )
              }
            )}

          </div>

        )}

      </div>

    </main>
  )
}


function MiniStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-[108px] rounded-2xl border border-[#E0E8EA] bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8B9CA2]">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-[#21434C]">
        {value}
      </p>
    </div>
  )
}


function getPrivacyLabel(
  mode: PrivacyMode
) {
  if (
    mode === "PUBLIC"
  ) {
    return "Public"
  }

  if (
    mode === "PASSWORD"
  ) {
    return "Password"
  }

  return "Private"
}


function getDaysRemaining(
  value: string
) {
  const deadline =
    new Date(value).getTime()

  const now =
    Date.now()

  const difference =
    deadline - now

  if (
    difference <= 0
  ) {
    return 0
  }

  return Math.max(
    1,
    Math.ceil(
      difference /
      (1000 * 60 * 60 * 24)
    )
  )
}


function formatDateTime(
  value: string
) {
  const date =
    new Date(value)

  return new Intl.DateTimeFormat(
    "en-MY",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date)
}


function formatBytes(
  bytes: number
) {
  if (
    bytes < 1024
  ) {
    return `${bytes} B`
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(1)} KB`
  }

  if (
    bytes <
    1024 *
    1024 *
    1024
  ) {
    return `${(
      bytes /
      1024 /
      1024
    ).toFixed(1)} MB`
  }

  return `${(
    bytes /
    1024 /
    1024 /
    1024
  ).toFixed(2)} GB`
}
