"use client"

import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  CloudUpload,
  FileImage,
  HardDrive,
  Images,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"

import type {
  LucideIcon,
} from "lucide-react"

import { useRouter } from "next/navigation"

import {
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { apiFetch } from "@/lib/api"


type EventStatus =
  | "DRAFT"
  | "LIVE"
  | "CLOSED"


type EventSale = {
  id: string
  workspace_id: string

  title: string
  slug: string

  description: string | null

  event_date: string | null
  location: string | null

  status: EventStatus

  allow_browse: boolean
  allow_bib_search: boolean
  allow_face_search: boolean

  price_per_photo_cents: number
  price_per_photo_rm: number

  currency: string

  bundle_enabled: boolean
  bundle_quantity: number
  bundle_price_cents: number
  bundle_price_rm: number

  sales_end_at: string | null
  sales_open: boolean

  photo_count: number
  ready_photo_count: number
  storage_bytes: number

  created_at: string
  updated_at: string
}


type EventPhoto = {
  id: string
  workspace_id: string
  event_id: string

  filename: string
  content_type: string
  size_bytes: number

  width: number | null
  height: number | null

  sort_order: number
  is_visible: boolean

  status: string

  processing_error: string | null

  preview_ready: boolean

  processed_at: string | null
  deleted_at: string | null

  created_at: string
  updated_at: string
}


type PhotosResponse = {
  event_id: string

  total: number

  limit: number
  offset: number
  has_more: boolean

  storage_bytes: number

  status_counts: Record<
    string,
    number
  >

  photos: EventPhoto[]
}


type PresignedUpload = {
  filename: string
  content_type: string
  file_size: number

  upload_url: string
  object_key: string

  method: string

  headers: Record<
    string,
    string
  >
}


type PresignResponse = {
  event_id: string
  expires_in: number

  uploads: PresignedUpload[]
}


type CompleteResponse = {
  ok: boolean

  event_id: string

  completed_count: number
  already_completed_count: number

  photos: EventPhoto[]
}


type UploadState =
  | "waiting"
  | "preparing"
  | "uploading"
  | "confirming"
  | "uploaded"
  | "failed"


type UploadItem = {
  id: string

  file: File

  state: UploadState

  progress: number

  error?: string
}


const MAX_FILE_SIZE =
  30 * 1024 * 1024

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
]


export default function EventDetailManager({
  eventId,
}: {
  eventId: string
}) {
  const router = useRouter()

  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    )

  const [
    eventData,
    setEventData,
  ] = useState<EventSale | null>(
    null
  )

  const [
    photos,
    setPhotos,
  ] = useState<EventPhoto[]>([])

  const [
    photoTotal,
    setPhotoTotal,
  ] = useState(0)

  const [
    storageBytes,
    setStorageBytes,
  ] = useState(0)

  const [
    statusCounts,
    setStatusCounts,
  ] = useState<
    Record<string, number>
  >({})

  const [
    hasMore,
    setHasMore,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false)

  const [
    uploading,
    setUploading,
  ] = useState(false)

  const [
    updatingStatus,
    setUpdatingStatus,
  ] = useState(false)

  const [
    deletingPhotoId,
    setDeletingPhotoId,
  ] = useState<string | null>(
    null
  )

  const [
    dragging,
    setDragging,
  ] = useState(false)

  const [
    queue,
    setQueue,
  ] = useState<UploadItem[]>([])

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("")

  const [
    statusMessage,
    setStatusMessage,
  ] = useState("")


  useEffect(() => {
    loadPage()
  }, [eventId])


  async function loadPage() {
    setLoading(true)
    setErrorMessage("")

    try {
      await Promise.all([
        loadEvent(),
        loadPhotos(
          true
        ),
      ])

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load event."
      )

    } finally {
      setLoading(false)
    }
  }


  async function loadEvent() {
    const result =
      await apiFetch<EventSale>(
        `/api/event-sales/events/${eventId}`
      )

    setEventData(
      result
    )
  }


  async function loadPhotos(
    reset: boolean
  ) {
    const offset =
      reset
        ? 0
        : photos.length

    const result =
      await apiFetch<PhotosResponse>(
        `/api/event-sales/events/${eventId}/photos?limit=100&offset=${offset}`
      )


    if (reset) {
      setPhotos(
        result.photos
      )
    } else {
      setPhotos(
        (current) => [
          ...current,
          ...result.photos,
        ]
      )
    }


    setPhotoTotal(
      result.total
    )

    setStorageBytes(
      result.storage_bytes
    )

    setStatusCounts(
      result.status_counts
    )

    setHasMore(
      result.has_more
    )
  }


  async function loadMorePhotos() {
    setLoadingMore(true)

    try {
      await loadPhotos(
        false
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load more photos."
      )

    } finally {
      setLoadingMore(false)
    }
  }


  function addFiles(
    files: File[]
  ) {
    setErrorMessage("")
    setStatusMessage("")


    const existingKeys =
      new Set(
        queue.map(
          (item) =>
            fileIdentity(
              item.file
            )
        )
      )


    const newItems:
      UploadItem[] = []

    let rejected = 0


    for (const file of files) {
      if (
        !ALLOWED_TYPES.includes(
          file.type
        )
      ) {
        rejected += 1
        continue
      }


      if (
        file.size <= 0
        || file.size
          > MAX_FILE_SIZE
      ) {
        rejected += 1
        continue
      }


      const identity =
        fileIdentity(
          file
        )

      if (
        existingKeys.has(
          identity
        )
      ) {
        continue
      }


      existingKeys.add(
        identity
      )


      newItems.push({
        id:
          crypto.randomUUID(),

        file,

        state:
          "waiting",

        progress:
          0,
      })
    }


    if (
      newItems.length > 0
    ) {
      setQueue(
        (current) => [
          ...current,
          ...newItems,
        ]
      )
    }


    if (
      rejected > 0
    ) {
      setErrorMessage(
        `${rejected} file(s) were skipped. Use JPEG, PNG or WebP images up to 30 MB each.`
      )
    }
  }


  function handleFileInput(
    files: FileList | null
  ) {
    if (!files) {
      return
    }

    addFiles(
      Array.from(
        files
      )
    )

    if (
      inputRef.current
    ) {
      inputRef.current.value =
        ""
    }
  }


  function handleDrop(
    dropEvent: DragEvent<HTMLDivElement>
  ) {
    dropEvent.preventDefault()

    setDragging(false)


    if (
      eventData?.status
      === "CLOSED"
    ) {
      return
    }


    addFiles(
      Array.from(
        dropEvent
          .dataTransfer
          .files
      )
    )
  }


  function updateQueueItem(
    id: string,
    values: Partial<UploadItem>
  ) {
    setQueue(
      (current) =>
        current.map(
          (item) =>
            item.id === id
              ? {
                  ...item,
                  ...values,
                }
              : item
        )
    )
  }


  function removeQueueItem(
    id: string
  ) {
    if (uploading) {
      return
    }

    setQueue(
      (current) =>
        current.filter(
          (item) =>
            item.id !== id
        )
    )
  }


  function clearCompleted() {
    setQueue(
      (current) =>
        current.filter(
          (item) =>
            item.state
            !== "uploaded"
        )
    )
  }


  async function startUploads() {
    if (
      !eventData
      || eventData.status
        === "CLOSED"
    ) {
      return
    }


    const candidates =
      queue.filter(
        (item) =>
          item.state === "waiting"
          || item.state === "failed"
      )


    if (
      candidates.length === 0
    ) {
      return
    }


    setUploading(true)
    setErrorMessage("")
    setStatusMessage("")


    try {
      const chunks =
        chunkArray(
          candidates,
          100
        )


      for (
        const chunk
        of chunks
      ) {
        for (
          const item
          of chunk
        ) {
          updateQueueItem(
            item.id,
            {
              state:
                "preparing",

              progress:
                0,

              error:
                undefined,
            }
          )
        }


        let presign:
          PresignResponse


        try {
          presign =
            await apiFetch<PresignResponse>(
              `/api/event-sales/events/${eventId}/photos/uploads/presign`,
              {
                method:
                  "POST",

                body:
                  JSON.stringify({
                    files:
                      chunk.map(
                        (item) => ({
                          filename:
                            item.file.name,

                          content_type:
                            item.file.type,

                          file_size:
                            item.file.size,
                        })
                      ),
                  }),
              }
            )

        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to prepare uploads."


          for (
            const item
            of chunk
          ) {
            updateQueueItem(
              item.id,
              {
                state:
                  "failed",

                error:
                  message,
              }
            )
          }

          continue
        }


        if (
          presign.uploads.length
          !== chunk.length
        ) {
          for (
            const item
            of chunk
          ) {
            updateQueueItem(
              item.id,
              {
                state:
                  "failed",

                error:
                  "Upload preparation returned an unexpected response.",
              }
            )
          }

          continue
        }


        const prepared =
          chunk.map(
            (
              item,
              index
            ) => ({
              item,

              upload:
                presign
                  .uploads[
                    index
                  ],
            })
          )


        await runWithConcurrency(
          prepared,
          4,
          async ({
            item,
            upload,
          }) => {
            try {
              updateQueueItem(
                item.id,
                {
                  state:
                    "uploading",

                  progress:
                    0,

                  error:
                    undefined,
                }
              )


              await uploadWithProgress(
                upload.upload_url,
                upload.headers,
                item.file,
                (progress) => {
                  updateQueueItem(
                    item.id,
                    {
                      progress,
                    }
                  )
                }
              )


              updateQueueItem(
                item.id,
                {
                  state:
                    "confirming",

                  progress:
                    100,
                }
              )


              const dimensions =
                await getImageDimensions(
                  item.file
                )


              await apiFetch<CompleteResponse>(
                `/api/event-sales/events/${eventId}/photos/uploads/complete`,
                {
                  method:
                    "POST",

                  body:
                    JSON.stringify({
                      files: [
                        {
                          object_key:
                            upload.object_key,

                          filename:
                            item.file.name,

                          content_type:
                            item.file.type,

                          width:
                            dimensions
                              ?.width
                              ?? null,

                          height:
                            dimensions
                              ?.height
                              ?? null,
                        },
                      ],
                    }),
                }
              )


              updateQueueItem(
                item.id,
                {
                  state:
                    "uploaded",

                  progress:
                    100,

                  error:
                    undefined,
                }
              )

            } catch (error) {
              updateQueueItem(
                item.id,
                {
                  state:
                    "failed",

                  error:
                    error instanceof Error
                      ? error.message
                      : "Upload failed.",
                }
              )
            }
          }
        )
      }


      await Promise.all([
        loadEvent(),
        loadPhotos(
          true
        ),
      ])


      setStatusMessage(
        "Upload process finished. Successfully registered photos now appear below."
      )

    } finally {
      setUploading(false)
    }
  }


  async function deletePhoto(
    photo: EventPhoto
  ) {
    const confirmed =
      window.confirm(
        `Delete "${photo.filename}"?\n\nThe private original will also be removed from storage.`
      )

    if (!confirmed) {
      return
    }


    setDeletingPhotoId(
      photo.id
    )

    setErrorMessage("")
    setStatusMessage("")


    try {
      await apiFetch(
        `/api/event-sales/events/${eventId}/photos/${photo.id}`,
        {
          method:
            "DELETE",
        }
      )


      await Promise.all([
        loadEvent(),
        loadPhotos(
          true
        ),
      ])


      setStatusMessage(
        `"${photo.filename}" was deleted.`
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete photo."
      )

    } finally {
      setDeletingPhotoId(
        null
      )
    }
  }


  async function changeStatus(
    nextStatus: EventStatus
  ) {
    if (!eventData) {
      return
    }


    setUpdatingStatus(true)
    setErrorMessage("")
    setStatusMessage("")


    try {
      const updated =
        await apiFetch<EventSale>(
          `/api/event-sales/events/${eventId}`,
          {
            method:
              "PATCH",

            body:
              JSON.stringify({
                status:
                  nextStatus,
              }),
          }
        )


      setEventData(
        updated
      )


      setStatusMessage(
        nextStatus === "LIVE"
          ? "Event is now live."
          : nextStatus
              === "CLOSED"
            ? "Event sales have been closed."
            : "Event returned to draft."
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update event status."
      )

    } finally {
      setUpdatingStatus(
        false
      )
    }
  }


  const waitingCount =
    useMemo(
      () =>
        queue.filter(
          (item) =>
            item.state === "waiting"
            || item.state === "failed"
        ).length,
      [queue]
    )


  const uploadedQueueCount =
    useMemo(
      () =>
        queue.filter(
          (item) =>
            item.state === "uploaded"
        ).length,
      [queue]
    )


  if (
    loading
    || !eventData
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8F9]">

        <div className="flex items-center gap-3 text-sm font-semibold text-[#58717A]">

          <Loader2 className="h-5 w-5 animate-spin text-[#0BA5B4]" />

          Loading event...

        </div>

      </div>
    )
  }


  const event =
    eventData


  return (
    <main className="min-h-screen bg-[#F5F8F9]">

      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-[#DFE8EA] bg-white/95 backdrop-blur">

        <div className="flex min-h-[76px] items-center justify-between gap-4 px-5 lg:px-8">

          <div className="flex min-w-0 items-center gap-4">

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/events"
                )
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E1EAEC] bg-white text-[#58717A] transition hover:bg-[#F4F8F9]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>


            <div className="min-w-0">

              <div className="flex items-center gap-2">

                <Camera className="h-4 w-4 shrink-0 text-[#0A99A7]" />

                <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-[#0A8D99]">
                  Event Sales
                </p>

              </div>


              <h1 className="mt-1 truncate text-lg font-semibold tracking-[-0.025em] text-[#183A44]">
                {event.title}
              </h1>

            </div>

          </div>


          <div className="flex items-center gap-2">

            <StatusBadge
              status={
                event.status
              }
            />


            {event.status === "DRAFT" && (

              <button
                type="button"
                disabled={
                  updatingStatus
                }
                onClick={() =>
                  changeStatus(
                    "LIVE"
                  )
                }
                className="hidden h-10 items-center gap-2 rounded-xl bg-[#073B4C] px-4 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:opacity-50 sm:flex"
              >
                {updatingStatus && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                Go live
              </button>

            )}


            {event.status === "LIVE" && (

              <button
                type="button"
                disabled={
                  updatingStatus
                }
                onClick={() =>
                  changeStatus(
                    "CLOSED"
                  )
                }
                className="hidden h-10 items-center gap-2 rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm font-semibold text-[#526D75] transition hover:bg-[#F5F8F9] disabled:opacity-50 sm:flex"
              >
                Close event
              </button>

            )}


            {event.status === "CLOSED" && (

              <button
                type="button"
                disabled={
                  updatingStatus
                }
                onClick={() =>
                  changeStatus(
                    "DRAFT"
                  )
                }
                className="hidden h-10 items-center gap-2 rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm font-semibold text-[#526D75] transition hover:bg-[#F5F8F9] disabled:opacity-50 sm:flex"
              >
                Reopen draft
              </button>

            )}

          </div>

        </div>

      </header>


      <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8 lg:py-10">

        {/* EVENT SUMMARY */}
        <section className="rounded-[28px] border border-[#DDE8EA] bg-white p-6 shadow-[0_12px_35px_rgba(16,55,65,0.04)] lg:p-7">

          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">
                Event workspace
              </p>

              <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#112D38]">
                {event.title}
              </h2>

              <p className="mt-2 text-sm text-[#80939A]">
                /event/{event.slug}
              </p>


              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#657D85]">

                <InfoItem
                  icon={
                    CalendarDays
                  }
                  value={
                    event.event_date
                      ? formatDate(
                          event.event_date
                        )
                      : "No event date"
                  }
                />

                <InfoItem
                  icon={
                    MapPin
                  }
                  value={
                    event.location
                      || "No location"
                  }
                />

                <InfoItem
                  icon={
                    CircleDollarSign
                  }
                  value={
                    `RM ${formatMoney(
                      event.price_per_photo_rm
                    )} / photo`
                  }
                />

              </div>

            </div>


            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

              <SummaryStat
                label="Photos"
                value={
                  photoTotal
                    .toString()
                }
              />

              <SummaryStat
                label="Ready"
                value={
                  (
                    statusCounts.READY
                    ?? event.ready_photo_count
                  ).toString()
                }
              />

              <SummaryStat
                label="Storage"
                value={
                  formatBytes(
                    storageBytes
                  )
                }
              />

              <SummaryStat
                label="Sales"
                value={
                  event.sales_open
                    ? "Open"
                    : "Closed"
                }
              />

            </div>

          </div>


          <div className="mt-7 flex flex-wrap gap-2 border-t border-[#E8EFF1] pt-5">

            <DiscoveryBadge
              active={
                event.allow_browse
              }
              icon={
                Images
              }
              label="Browse"
            />

            <DiscoveryBadge
              active={
                event.allow_bib_search
              }
              icon={
                Search
              }
              label="Bib search"
            />

            <DiscoveryBadge
              active={
                event.allow_face_search
              }
              icon={
                Camera
              }
              label="Selfie search"
            />

          </div>

        </section>


        {(errorMessage
          || statusMessage) && (

          <div
            className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
              errorMessage
                ? "border-[#F1D9DD] bg-[#FFF7F8] text-[#A54C58]"
                : "border-[#CEE8E2] bg-[#F1FAF7] text-[#267B64]"
            }`}
          >
            {
              errorMessage
              || statusMessage
            }
          </div>

        )}


        {/* UPLOAD */}
        <section className="mt-6 rounded-[28px] border border-[#DDE8EA] bg-white p-6 lg:p-7">

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">
                Originals
              </p>

              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#173943]">
                Upload event photos
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#758B92]">
                Originals are uploaded directly to private storage. They will not be publicly exposed.
              </p>

            </div>


            {queue.length > 0 && (

              <div className="flex gap-2">

                {uploadedQueueCount > 0 && (

                  <button
                    type="button"
                    disabled={
                      uploading
                    }
                    onClick={
                      clearCompleted
                    }
                    className="h-10 rounded-xl border border-[#DCE6E8] px-3.5 text-sm font-semibold text-[#60777F] transition hover:bg-[#F7F9FA] disabled:opacity-50"
                  >
                    Clear completed
                  </button>

                )}


                <button
                  type="button"
                  disabled={
                    uploading
                    || waitingCount === 0
                    || event.status
                      === "CLOSED"
                  }
                  onClick={
                    startUploads
                  }
                  className="flex h-10 items-center gap-2 rounded-xl bg-[#073B4C] px-4 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}

                  {uploading
                    ? "Uploading..."
                    : `Upload ${waitingCount || ""}`}

                </button>

              </div>

            )}

          </div>


          {event.status === "CLOSED" ? (

            <div className="mt-6 rounded-2xl border border-[#E4DFE0] bg-[#FAF7F7] p-5 text-sm leading-6 text-[#806E73]">
              This event is closed. Reopen it as a draft before uploading additional photographs.
            </div>

          ) : (

            <div
              onDragEnter={(dragEvent) => {
                dragEvent.preventDefault()
                setDragging(true)
              }}
              onDragOver={(dragEvent) => {
                dragEvent.preventDefault()
                setDragging(true)
              }}
              onDragLeave={(dragEvent) => {
                dragEvent.preventDefault()
                setDragging(false)
              }}
              onDrop={
                handleDrop
              }
              className={`mt-6 flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-6 text-center transition ${
                dragging
                  ? "border-[#55BCC5] bg-[#F0FAFA]"
                  : "border-[#C9DADD] bg-[#FAFCFC]"
              }`}
            >

              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#E5F7F8]">
                <CloudUpload className="h-7 w-7 text-[#0A9AA7]" />
              </div>


              <h3 className="mt-5 text-lg font-semibold tracking-[-0.025em] text-[#24464F]">
                Drop event photos here
              </h3>


              <p className="mt-2 max-w-md text-sm leading-6 text-[#7C9097]">
                JPEG, PNG or WebP. Maximum 30 MB per photograph. You can select many files at once.
              </p>


              <button
                type="button"
                onClick={() =>
                  inputRef
                    .current
                    ?.click()
                }
                className="mt-5 flex h-11 items-center gap-2 rounded-xl border border-[#CEE0E3] bg-white px-5 text-sm font-semibold text-[#31545D] transition hover:bg-[#F7FAFB]"
              >
                <Images className="h-4 w-4" />
                Choose photos
              </button>


              <input
                ref={
                  inputRef
                }
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(inputEvent) =>
                  handleFileInput(
                    inputEvent
                      .target
                      .files
                  )
                }
                className="hidden"
              />

            </div>

          )}


          {/* UPLOAD QUEUE */}
          {queue.length > 0 && (

            <div className="mt-6 overflow-hidden rounded-2xl border border-[#DFE8EA]">

              <div className="flex items-center justify-between border-b border-[#E5ECEE] bg-[#F8FBFB] px-4 py-3">

                <p className="text-sm font-semibold text-[#385962]">
                  Upload queue
                </p>

                <p className="text-xs font-medium text-[#83969C]">
                  {queue.length} file(s)
                </p>

              </div>


              <div className="max-h-[430px] divide-y divide-[#E8EFF1] overflow-y-auto">

                {queue.map(
                  (item) => (

                    <UploadRow
                      key={
                        item.id
                      }
                      item={
                        item
                      }
                      locked={
                        uploading
                      }
                      onRemove={() =>
                        removeQueueItem(
                          item.id
                        )
                      }
                    />

                  )
                )}

              </div>

            </div>

          )}

        </section>


        {/* PHOTO LIBRARY */}
        <section className="mt-6 rounded-[28px] border border-[#DDE8EA] bg-white p-6 lg:p-7">

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">
                Event library
              </p>

              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#173943]">
                Uploaded photos
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#758B92]">
                These originals are waiting for the AI processing pipeline.
              </p>

            </div>


            <button
              type="button"
              onClick={async () => {
                try {
                  await Promise.all([
                    loadEvent(),
                    loadPhotos(
                      true
                    ),
                  ])
                } catch (error) {
                  setErrorMessage(
                    error instanceof Error
                      ? error.message
                      : "Unable to refresh."
                  )
                }
              }}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm font-semibold text-[#526D75] transition hover:bg-[#F5F8F9]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

          </div>


          {photos.length === 0 ? (

            <div className="mt-6 flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D2DFE2] bg-[#FAFCFC] px-6 text-center">

              <FileImage className="h-7 w-7 text-[#91A5AB]" />

              <p className="mt-4 text-sm font-semibold text-[#526E76]">
                No photos uploaded yet
              </p>

              <p className="mt-1 text-xs text-[#8A9CA2]">
                Add some originals using the uploader above.
              </p>

            </div>

          ) : (

            <div className="mt-6 overflow-hidden rounded-2xl border border-[#DFE8EA]">

              <div className="hidden grid-cols-[minmax(0,1fr)_120px_110px_110px_52px] gap-4 border-b border-[#E5ECEE] bg-[#F8FBFB] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#82959B] md:grid">

                <div>
                  Photo
                </div>

                <div>
                  Size
                </div>

                <div>
                  Status
                </div>

                <div>
                  Preview
                </div>

                <div />

              </div>


              <div className="divide-y divide-[#E8EFF1]">

                {photos.map(
                  (photo) => (

                    <PhotoRow
                      key={
                        photo.id
                      }
                      photo={
                        photo
                      }
                      deleting={
                        deletingPhotoId
                        === photo.id
                      }
                      onDelete={() =>
                        deletePhoto(
                          photo
                        )
                      }
                    />

                  )
                )}

              </div>

            </div>

          )}


          {hasMore && (

            <div className="mt-5 flex justify-center">

              <button
                type="button"
                disabled={
                  loadingMore
                }
                onClick={
                  loadMorePhotos
                }
                className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE6E8] px-4 text-sm font-semibold text-[#526D75] transition hover:bg-[#F5F8F9] disabled:opacity-50"
              >

                {loadingMore && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                Load more
              </button>

            </div>

          )}

        </section>

      </div>

    </main>
  )
}


function UploadRow({
  item,
  locked,
  onRemove,
}: {
  item: UploadItem
  locked: boolean
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF7F8]">
        <FileImage className="h-4 w-4 text-[#298B96]" />
      </div>


      <div className="min-w-0 flex-1">

        <div className="flex items-center justify-between gap-3">

          <p className="truncate text-sm font-semibold text-[#35565F]">
            {item.file.name}
          </p>

          <QueueStatus
            item={
              item
            }
          />

        </div>


        <div className="mt-1 flex items-center gap-3 text-xs text-[#8A9CA2]">

          <span>
            {formatBytes(
              item.file.size
            )}
          </span>

          {item.state === "uploading" && (
            <span>
              {item.progress}%
            </span>
          )}

        </div>


        {(item.state
          === "uploading"
          || item.state
            === "confirming") && (

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E5EDEF]">

            <div
              className="h-full rounded-full bg-[#16A7B4] transition-all"
              style={{
                width:
                  `${item.progress}%`,
              }}
            />

          </div>

        )}


        {item.error && (

          <p className="mt-1.5 text-xs leading-5 text-[#B05B66]">
            {item.error}
          </p>

        )}

      </div>


      {!locked
        && item.state
          !== "uploaded" && (

        <button
          type="button"
          onClick={
            onRemove
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8B9DA2] transition hover:bg-[#F5F8F9]"
        >
          <XCircle className="h-4 w-4" />
        </button>

      )}

    </div>
  )
}


function QueueStatus({
  item,
}: {
  item: UploadItem
}) {
  if (
    item.state
    === "uploaded"
  ) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#248069]">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Uploaded
      </span>
    )
  }


  if (
    item.state
    === "failed"
  ) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#A95460]">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    )
  }


  if (
    item.state
    === "uploading"
  ) {
    return (
      <span className="shrink-0 text-xs font-semibold text-[#217E89]">
        Uploading
      </span>
    )
  }


  if (
    item.state
    === "confirming"
  ) {
    return (
      <span className="shrink-0 text-xs font-semibold text-[#217E89]">
        Registering
      </span>
    )
  }


  if (
    item.state
    === "preparing"
  ) {
    return (
      <span className="shrink-0 text-xs font-semibold text-[#72868D]">
        Preparing
      </span>
    )
  }


  return (
    <span className="shrink-0 text-xs font-semibold text-[#87999F]">
      Ready
    </span>
  )
}


function PhotoRow({
  photo,
  deleting,
  onDelete,
}: {
  photo: EventPhoto
  deleting: boolean
  onDelete: () => void
}) {
  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_120px_110px_110px_52px] md:items-center md:gap-4">

      <div className="flex min-w-0 items-center gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF7F8]">
          <FileImage className="h-4 w-4 text-[#298B96]" />
        </div>


        <div className="min-w-0">

          <p className="truncate text-sm font-semibold text-[#35565F]">
            {photo.filename}
          </p>

          <p className="mt-1 text-xs text-[#8A9CA2]">
            {photo.width
              && photo.height
              ? `${photo.width} × ${photo.height}`
              : "Dimensions unavailable"}
          </p>

        </div>

      </div>


      <p className="text-sm text-[#6F858C]">
        {formatBytes(
          photo.size_bytes
        )}
      </p>


      <PhotoStatusBadge
        status={
          photo.status
        }
      />


      <p className="text-sm font-medium text-[#6F858C]">
        {photo.preview_ready
          ? "Ready"
          : "Not yet"}
      </p>


      <button
        type="button"
        disabled={
          deleting
        }
        onClick={
          onDelete
        }
        title="Delete photo"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E4EAEC] text-[#9A6A72] transition hover:border-[#F0D4D9] hover:bg-[#FFF6F7] disabled:opacity-50"
      >
        {deleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>

    </div>
  )
}


function PhotoStatusBadge({
  status,
}: {
  status: string
}) {
  const style =
    status === "READY"
      ? "border-[#CBE9DF] bg-[#EFFAF6] text-[#21745F]"
      : status === "FAILED"
        ? "border-[#F0D7DB] bg-[#FFF6F7] text-[#A95460]"
        : status === "PROCESSING"
          ? "border-[#CDE7EB] bg-[#F0F9FA] text-[#277B86]"
          : "border-[#DFE7E9] bg-[#F8FAFB] text-[#70858C]"


  return (
    <span
      className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${style}`}
    >
      {status}
    </span>
  )
}


function StatusBadge({
  status,
}: {
  status: EventStatus
}) {
  const styles = {
    DRAFT:
      "border-[#DDE7E9] bg-white text-[#6E838A]",

    LIVE:
      "border-[#CBE9DF] bg-[#EFFAF6] text-[#21745F]",

    CLOSED:
      "border-[#E5DFE0] bg-[#FAF6F7] text-[#846D73]",
  }


  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${styles[status]}`}
    >
      {status}
    </span>
  )
}


function SummaryStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-[105px] rounded-2xl border border-[#E0E9EB] bg-[#FAFCFC] px-4 py-3">

      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#85979D]">
        {label}
      </p>

      <p className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#24464F]">
        {value}
      </p>

    </div>
  )
}


function InfoItem({
  icon: Icon,
  value,
}: {
  icon: LucideIcon
  value: string
}) {
  return (
    <div className="flex items-center gap-2">

      <Icon className="h-4 w-4 text-[#89A0A7]" />

      <span>
        {value}
      </span>

    </div>
  )
}


function DiscoveryBadge({
  active,
  icon: Icon,
  label,
}: {
  active: boolean
  icon: LucideIcon
  label: string
}) {
  return (
    <span
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        active
          ? "border-[#C7E7E9] bg-[#F1FAFA] text-[#267681]"
          : "border-[#E3E9EB] bg-[#F8FAFB] text-[#9AA8AC]"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />

      {label}
    </span>
  )
}


function fileIdentity(
  file: File
) {
  return [
    file.name,
    file.size,
    file.lastModified,
  ].join(":")
}


function chunkArray<T>(
  items: T[],
  size: number
): T[][] {
  const chunks: T[][] = []

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    chunks.push(
      items.slice(
        index,
        index + size
      )
    )
  }

  return chunks
}


async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (
    item: T
  ) => Promise<void>
) {
  let nextIndex = 0


  const runners =
    Array.from(
      {
        length:
          Math.min(
            limit,
            items.length
          ),
      },
      async () => {
        while (true) {
          const index =
            nextIndex

          nextIndex += 1


          if (
            index
            >= items.length
          ) {
            return
          }


          await worker(
            items[index]
          )
        }
      }
    )


  await Promise.all(
    runners
  )
}


function uploadWithProgress(
  uploadUrl: string,
  headers: Record<
    string,
    string
  >,
  file: File,
  onProgress: (
    progress: number
  ) => void
) {
  return new Promise<void>(
    (
      resolve,
      reject
    ) => {
      const request =
        new XMLHttpRequest()


      request.open(
        "PUT",
        uploadUrl
      )


      for (
        const [
          key,
          value,
        ]
        of Object.entries(
          headers
        )
      ) {
        request.setRequestHeader(
          key,
          value
        )
      }


      request.upload.onprogress =
        (progressEvent) => {
          if (
            !progressEvent
              .lengthComputable
          ) {
            return
          }


          const progress =
            Math.round(
              (
                progressEvent.loaded
                / progressEvent.total
              )
              * 100
            )


          onProgress(
            progress
          )
        }


      request.onload = () => {
        if (
          request.status
          >= 200
          && request.status
          < 300
        ) {
          onProgress(
            100
          )

          resolve()

          return
        }


        reject(
          new Error(
            `Storage upload failed with status ${request.status}.`
          )
        )
      }


      request.onerror = () =>
        reject(
          new Error(
            "Unable to upload photo to private storage."
          )
        )


      request.onabort = () =>
        reject(
          new Error(
            "Photo upload was cancelled."
          )
        )


      request.send(
        file
      )
    }
  )
}


async function getImageDimensions(
  file: File
) {
  try {
    const bitmap =
      await createImageBitmap(
        file
      )


    const dimensions = {
      width:
        bitmap.width,

      height:
        bitmap.height,
    }


    bitmap.close()


    return dimensions

  } catch {
    return null
  }
}


function formatBytes(
  value: number
) {
  if (
    !value
    || value <= 0
  ) {
    return "0 B"
  }


  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ]


  const index =
    Math.min(
      Math.floor(
        Math.log(
          value
        )
        / Math.log(
          1024
        )
      ),
      units.length - 1
    )


  const result =
    value
    / Math.pow(
      1024,
      index
    )


  return (
    `${result.toFixed(
      index === 0
        ? 0
        : 1
    )} ${units[index]}`
  )
}


function formatMoney(
  value: number
) {
  return Number(
    value || 0
  ).toFixed(
    2
  )
}


function formatDate(
  value: string
) {
  return new Date(
    `${value}T00:00:00`
  ).toLocaleDateString(
    "en-MY",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    }
  )
}