"use client"

import {
  ArrowLeft,
  CalendarDays,
  Camera,
  ChevronRight,
  CircleDollarSign,
  Images,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"

import { useRouter } from "next/navigation"

import {
  FormEvent,
  useEffect,
  useMemo,
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


type EventsResponse = {
  events: EventSale[]
}


type CreateForm = {
  title: string
  slug: string
  eventDate: string
  location: string

  priceRM: string

  bundleEnabled: boolean
  bundleQuantity: string
  bundlePriceRM: string

  allowBrowse: boolean
  allowBibSearch: boolean
  allowFaceSearch: boolean
}


const emptyForm: CreateForm = {
  title: "",
  slug: "",
  eventDate: "",
  location: "",

  priceRM: "10.00",

  bundleEnabled: false,
  bundleQuantity: "5",
  bundlePriceRM: "40.00",

  allowBrowse: true,
  allowBibSearch: true,
  allowFaceSearch: true,
}


export default function EventManager() {
  const router = useRouter()

  const [
    events,
    setEvents,
  ] = useState<EventSale[]>([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    creating,
    setCreating,
  ] = useState(false)

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null
  )

  const [
    showCreate,
    setShowCreate,
  ] = useState(false)

  const [
    form,
    setForm,
  ] = useState<CreateForm>(
    emptyForm
  )

  const [
    statusMessage,
    setStatusMessage,
  ] = useState("")

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("")


  useEffect(() => {
    loadEvents()
  }, [])


  async function loadEvents() {
    setLoading(true)
    setErrorMessage("")

    try {
      const result =
        await apiFetch<EventsResponse>(
          "/api/event-sales/events"
        )

      setEvents(
        result.events
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load events."
      )

    } finally {
      setLoading(false)
    }
  }


  const liveCount =
    useMemo(
      () =>
        events.filter(
          (event) =>
            event.status === "LIVE"
        ).length,
      [events]
    )


  const totalPhotos =
    useMemo(
      () =>
        events.reduce(
          (
            total,
            event
          ) =>
            total
            + event.photo_count,
          0
        ),
      [events]
    )


  const totalReady =
    useMemo(
      () =>
        events.reduce(
          (
            total,
            event
          ) =>
            total
            + event.ready_photo_count,
          0
        ),
      [events]
    )


  function updateForm<
    K extends keyof CreateForm
  >(
    key: K,
    value: CreateForm[K]
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      })
    )

    setErrorMessage("")
    setStatusMessage("")
  }


  function slugify(
    value: string
  ) {
    return value
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(
        0,
        120
      )
  }


  function handleTitleChange(
    value: string
  ) {
    setForm(
      (current) => {
        const currentAutoSlug =
          slugify(
            current.title
          )

        return {
          ...current,

          title: value,

          slug:
            current.slug === ""
            || current.slug
              === currentAutoSlug
              ? slugify(value)
              : current.slug,
        }
      }
    )

    setErrorMessage("")
  }


  function resetCreateForm() {
    setForm(
      emptyForm
    )

    setErrorMessage("")
    setStatusMessage("")
  }


  function closeCreatePanel() {
    setShowCreate(false)
    resetCreateForm()
  }


  async function createEvent(
    submitEvent: FormEvent
  ) {
    submitEvent.preventDefault()

    setCreating(true)
    setErrorMessage("")
    setStatusMessage("")

    try {
      if (
        !form.title.trim()
      ) {
        throw new Error(
          "Event title is required."
        )
      }


      const priceRM =
        Number(
          form.priceRM
        )

      if (
        Number.isNaN(
          priceRM
        )
        || priceRM < 0
      ) {
        throw new Error(
          "Enter a valid photo price."
        )
      }


      const bundleQuantity =
        Number(
          form.bundleQuantity
        )

      const bundlePriceRM =
        Number(
          form.bundlePriceRM
        )


      if (
        form.bundleEnabled
        && (
          !Number.isInteger(
            bundleQuantity
          )
          || bundleQuantity <= 0
        )
      ) {
        throw new Error(
          "Bundle quantity must be greater than zero."
        )
      }


      if (
        form.bundleEnabled
        && (
          Number.isNaN(
            bundlePriceRM
          )
          || bundlePriceRM < 0
        )
      ) {
        throw new Error(
          "Enter a valid bundle price."
        )
      }


      if (
        !form.allowBrowse
        && !form.allowBibSearch
        && !form.allowFaceSearch
      ) {
        throw new Error(
          "Enable at least one customer discovery method."
        )
      }


      const payload = {
        title:
          form.title.trim(),

        slug:
          form.slug.trim()
            ? slugify(
                form.slug
              )
            : null,

        description:
          null,

        event_date:
          form.eventDate
            || null,

        location:
          form.location.trim()
            || null,

        status:
          "DRAFT",

        allow_browse:
          form.allowBrowse,

        allow_bib_search:
          form.allowBibSearch,

        allow_face_search:
          form.allowFaceSearch,

        price_per_photo_cents:
          Math.round(
            priceRM * 100
          ),

        currency:
          "MYR",

        bundle_enabled:
          form.bundleEnabled,

        bundle_quantity:
          form.bundleEnabled
            ? bundleQuantity
            : 5,

        bundle_price_cents:
          form.bundleEnabled
            ? Math.round(
                bundlePriceRM
                * 100
              )
            : 4000,

        sales_end_at:
          null,
      }


      const created =
        await apiFetch<EventSale>(
          "/api/event-sales/events",
          {
            method: "POST",

            body:
              JSON.stringify(
                payload
              ),
          }
        )


      setEvents(
        (current) => [
          created,
          ...current,
        ]
      )


      setShowCreate(
        false
      )

      resetCreateForm()

      setStatusMessage(
        `"${created.title}" was created as a draft event.`
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create event."
      )

    } finally {
      setCreating(false)
    }
  }


  async function deleteEvent(
    event: EventSale
  ) {
    if (
      event.status === "LIVE"
    ) {
      setErrorMessage(
        "A live event must be closed before it can be deleted."
      )

      return
    }


    if (
      event.photo_count > 0
    ) {
      setErrorMessage(
        "This event contains photos. Remove its photos before deleting the event."
      )

      return
    }


    const confirmed =
      window.confirm(
        `Delete "${event.title}"?\n\nThis action cannot be undone.`
      )

    if (!confirmed) {
      return
    }


    setDeletingId(
      event.id
    )

    setErrorMessage("")
    setStatusMessage("")


    try {
      await apiFetch(
        `/api/event-sales/events/${event.id}`,
        {
          method:
            "DELETE",
        }
      )


      setEvents(
        (current) =>
          current.filter(
            (item) =>
              item.id
              !== event.id
          )
      )


      setStatusMessage(
        `"${event.title}" was deleted.`
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete event."
      )

    } finally {
      setDeletingId(
        null
      )
    }
  }


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F9FA]">

        <div className="flex items-center gap-3 text-sm font-semibold text-[#58717A]">

          <Loader2 className="h-5 w-5 animate-spin text-[#0BA5B4]" />

          Loading Event Sales...

        </div>

      </div>
    )
  }


  return (
    <main className="min-h-screen bg-[#F5F8F9]">

      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-[#DFE8EA] bg-white/95 backdrop-blur">

        <div className="flex min-h-[76px] items-center justify-between gap-5 px-5 lg:px-8">

          <div className="flex items-center gap-4">

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard"
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E1EAEC] bg-white text-[#58717A] transition hover:bg-[#F4F8F9]"
            >

              <ArrowLeft className="h-4 w-4" />

            </button>


            <div>

              <div className="flex items-center gap-2">

                <Camera className="h-4 w-4 text-[#0A99A7]" />

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0A8D99]">
                  Event Sales
                </p>

              </div>


              <h1 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#183A44]">
                Event Manager
              </h1>

            </div>

          </div>


          <button
            type="button"
            onClick={() => {
              resetCreateForm()
              setShowCreate(true)
            }}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#073B4C] px-4 text-sm font-semibold text-white transition hover:bg-[#0B5363]"
          >

            <Plus className="h-4 w-4" />

            <span className="hidden sm:inline">
              New event
            </span>

            <span className="sm:hidden">
              New
            </span>

          </button>

        </div>

      </header>


      {/* PAGE */}
      <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8 lg:py-10">

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

          <div>

            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">
              Photography commerce
            </p>

            <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#112D38]">
              Your events
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6D8289]">
              Upload event photography, prepare searchable galleries and sell original photographs to participants.
            </p>

          </div>


          <div className="flex flex-wrap gap-3">

            <MiniStat
              label="Events"
              value={
                events.length
                  .toString()
              }
            />

            <MiniStat
              label="Live"
              value={
                liveCount
                  .toString()
              }
            />

            <MiniStat
              label="Photos"
              value={
                totalPhotos
                  .toString()
              }
            />

            <MiniStat
              label="Ready"
              value={
                totalReady
                  .toString()
              }
            />

          </div>

        </div>


        {(errorMessage
          || statusMessage) && (

          <div
            className={`mt-7 rounded-2xl border px-5 py-4 text-sm font-semibold ${
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


        {events.length === 0 ? (

          <EmptyState
            onCreate={() => {
              resetCreateForm()
              setShowCreate(true)
            }}
          />

        ) : (

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">

            {events.map(
              (event) => (

                <EventCard
                  key={
                    event.id
                  }
                  event={
                    event
                  }
                  deleting={
                    deletingId
                    === event.id
                  }
                  onManage={() =>
                    router.push(
                      `/dashboard/events/${event.id}`
                    )
                  }
                  onDelete={() =>
                    deleteEvent(
                      event
                    )
                  }
                />

              )
            )}

          </div>

        )}

      </div>


      {/* CREATE PANEL */}
      {showCreate && (

        <div className="fixed inset-0 z-50 flex items-start justify-end bg-[#071F27]/35 backdrop-blur-[2px]">

          <button
            type="button"
            aria-label="Close create event"
            onClick={
              closeCreatePanel
            }
            className="absolute inset-0"
          />


          <section className="relative z-10 h-full w-full overflow-y-auto bg-white shadow-2xl sm:max-w-[600px]">

            <div className="sticky top-0 z-10 flex min-h-[76px] items-center justify-between border-b border-[#E4EBED] bg-white/95 px-6 backdrop-blur">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A929F]">
                  New Event Sales gallery
                </p>

                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#163741]">
                  Create event
                </h2>

              </div>


              <button
                type="button"
                onClick={
                  closeCreatePanel
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E0E8EA] text-[#70868D] transition hover:bg-[#F6F9FA]"
              >
                <X className="h-4 w-4" />
              </button>

            </div>


            <form
              onSubmit={
                createEvent
              }
              className="space-y-8 p-6 pb-12"
            >

              <FormSection
                eyebrow="Details"
                title="Event information"
                description="Give the event a clear title and optional location and date."
              />


              <Field
                label="Event title"
                value={
                  form.title
                }
                placeholder="KL Marathon 2026"
                onChange={
                  handleTitleChange
                }
              />


              <Field
                label="Event address"
                value={
                  form.slug
                }
                placeholder="kl-marathon-2026"
                prefix="/event/"
                onChange={(value) =>
                  updateForm(
                    "slug",
                    slugify(
                      value
                    )
                  )
                }
              />


              <div className="grid gap-4 sm:grid-cols-2">

                <DateField
                  label="Event date"
                  value={
                    form.eventDate
                  }
                  onChange={(value) =>
                    updateForm(
                      "eventDate",
                      value
                    )
                  }
                />


                <Field
                  label="Location"
                  value={
                    form.location
                  }
                  placeholder="Kuala Lumpur"
                  onChange={(value) =>
                    updateForm(
                      "location",
                      value
                    )
                  }
                />

              </div>


              <Divider />


              <FormSection
                eyebrow="Discovery"
                title="How can customers find photos?"
                description="You can adjust these settings again before the event goes live."
              />


              <div className="space-y-3">

                <ToggleOption
                  checked={
                    form.allowBrowse
                  }
                  title="Browse gallery"
                  description="Customers can manually browse available event photos."
                  icon={
                    Images
                  }
                  onChange={(value) =>
                    updateForm(
                      "allowBrowse",
                      value
                    )
                  }
                />


                <ToggleOption
                  checked={
                    form.allowBibSearch
                  }
                  title="Bib number search"
                  description="Customers can search photographs using their race bib."
                  icon={
                    Search
                  }
                  onChange={(value) =>
                    updateForm(
                      "allowBibSearch",
                      value
                    )
                  }
                />


                <ToggleOption
                  checked={
                    form.allowFaceSearch
                  }
                  title="Selfie face search"
                  description="Customers can use a selfie to retrieve visually matching event photographs."
                  icon={
                    Camera
                  }
                  onChange={(value) =>
                    updateForm(
                      "allowFaceSearch",
                      value
                    )
                  }
                />

              </div>


              <Divider />


              <FormSection
                eyebrow="Pricing"
                title="Photo pricing"
                description="Set the base selling price for each original photograph."
              />


              <MoneyField
                label="Price per photo"
                value={
                  form.priceRM
                }
                onChange={(value) =>
                  updateForm(
                    "priceRM",
                    value
                  )
                }
              />


              <ToggleOption
                checked={
                  form.bundleEnabled
                }
                title="Enable photo bundle"
                description="Offer a discounted price when customers purchase a set number of photos."
                icon={
                  CircleDollarSign
                }
                onChange={(value) =>
                  updateForm(
                    "bundleEnabled",
                    value
                  )
                }
              />


              {form.bundleEnabled && (

                <div className="grid gap-4 rounded-2xl border border-[#DDE9EB] bg-[#F8FBFB] p-4 sm:grid-cols-2">

                  <NumberField
                    label="Photos in bundle"
                    value={
                      form.bundleQuantity
                    }
                    onChange={(value) =>
                      updateForm(
                        "bundleQuantity",
                        value
                      )
                    }
                  />


                  <MoneyField
                    label="Bundle price"
                    value={
                      form.bundlePriceRM
                    }
                    onChange={(value) =>
                      updateForm(
                        "bundlePriceRM",
                        value
                      )
                    }
                  />

                </div>

              )}


              {errorMessage && (

                <div className="rounded-2xl border border-[#F1D9DD] bg-[#FFF7F8] px-4 py-3 text-sm font-semibold text-[#A54C58]">
                  {errorMessage}
                </div>

              )}


              <div className="flex items-center justify-end gap-3 border-t border-[#E7EDEF] pt-6">

                <button
                  type="button"
                  onClick={
                    closeCreatePanel
                  }
                  disabled={
                    creating
                  }
                  className="h-11 rounded-xl border border-[#DDE7E9] px-5 text-sm font-semibold text-[#60777F] transition hover:bg-[#F7F9FA] disabled:opacity-50"
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  disabled={
                    creating
                  }
                  className="flex h-11 items-center gap-2 rounded-xl bg-[#073B4C] px-5 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}

                  {creating
                    ? "Creating..."
                    : "Create event"}

                </button>

              </div>

            </form>

          </section>

        </div>

      )}

    </main>
  )
}


function EventCard({
  event,
  deleting,
  onManage,
  onDelete,
}: {
  event: EventSale
  deleting: boolean
  onManage: () => void
  onDelete: () => void
}) {
  return (
    <article className="overflow-hidden rounded-[24px] border border-[#DFE8EA] bg-white shadow-[0_10px_30px_rgba(16,55,65,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(16,55,65,0.07)]">

      <div className="border-b border-[#E8EFF1] bg-[#F8FBFB] p-5">

        <div className="flex items-start justify-between gap-4">

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E6F7F8]">
            <Camera className="h-5 w-5 text-[#0A97A4]" />
          </div>


          <StatusBadge
            status={
              event.status
            }
          />

        </div>


        <h3 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[#173943]">
          {event.title}
        </h3>


        <p className="mt-1 text-xs font-medium text-[#82949A]">
          /event/{event.slug}
        </p>

      </div>


      <div className="p-5">

        <div className="grid grid-cols-2 gap-3">

          <CardStat
            label="Photos"
            value={
              event.photo_count
                .toString()
            }
          />

          <CardStat
            label="Ready"
            value={
              event.ready_photo_count
                .toString()
            }
          />

          <CardStat
            label="Per photo"
            value={
              `RM ${formatMoney(
                event.price_per_photo_rm
              )}`
            }
          />

          <CardStat
            label="Sales"
            value={
              event.sales_open
                ? "Open"
                : "Closed"
            }
          />

        </div>


        <div className="mt-5 space-y-2.5 text-sm text-[#6B8188]">

          <InfoRow
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

          <InfoRow
            icon={
              MapPin
            }
            value={
              event.location
                || "No location"
            }
          />

        </div>


        <div className="mt-6 flex items-center gap-2">

          <button
            type="button"
            onClick={
              onManage
            }
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-4 text-sm font-semibold text-white transition hover:bg-[#0B5363]"
          >
            Manage event

            <ChevronRight className="h-4 w-4" />
          </button>


          <button
            type="button"
            onClick={
              onDelete
            }
            disabled={
              deleting
            }
            title="Delete event"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4EAEC] text-[#9A6A72] transition hover:border-[#F0D4D9] hover:bg-[#FFF6F7] disabled:opacity-50"
          >

            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}

          </button>

        </div>

      </div>

    </article>
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


function EmptyState({
  onCreate,
}: {
  onCreate: () => void
}) {
  return (
    <div className="mt-8 flex min-h-[430px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#CFDDE0] bg-white px-6 text-center">

      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#E9F8F9]">
        <Camera className="h-7 w-7 text-[#0A9EAB]" />
      </div>


      <h3 className="mt-6 text-xl font-semibold tracking-[-0.025em] text-[#173943]">
        No events yet
      </h3>


      <p className="mt-2 max-w-md text-sm leading-6 text-[#778C93]">
        Create your first photography event, upload the originals and prepare them for customer search and sales.
      </p>


      <button
        type="button"
        onClick={
          onCreate
        }
        className="mt-6 flex h-11 items-center gap-2 rounded-xl bg-[#073B4C] px-5 text-sm font-semibold text-white transition hover:bg-[#0B5363]"
      >
        <Plus className="h-4 w-4" />
        Create your first event
      </button>

    </div>
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
    <div className="min-w-[100px] rounded-2xl border border-[#DEE8EA] bg-white px-4 py-3">

      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#85979D]">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#193B45]">
        {value}
      </p>

    </div>
  )
}


function CardStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-[#E5ECEE] bg-[#FAFCFC] px-3 py-3">

      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8A9AA0]">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-[#264750]">
        {value}
      </p>

    </div>
  )
}


function InfoRow({
  icon: Icon,
  value,
}: {
  icon: typeof CalendarDays
  value: string
}) {
  return (
    <div className="flex items-center gap-2.5">

      <Icon className="h-4 w-4 shrink-0 text-[#86A0A7]" />

      <span className="truncate">
        {value}
      </span>

    </div>
  )
}


function FormSection({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>

      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0A929F]">
        {eyebrow}
      </p>

      <h3 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#173943]">
        {title}
      </h3>

      <p className="mt-1 text-sm leading-6 text-[#778C93]">
        {description}
      </p>

    </div>
  )
}


function Field({
  label,
  value,
  placeholder,
  prefix,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  prefix?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">

      <span className="mb-2 block text-sm font-semibold text-[#405E67]">
        {label}
      </span>


      <div className="flex h-12 overflow-hidden rounded-xl border border-[#DCE6E8] bg-white focus-within:border-[#77C9D0] focus-within:ring-2 focus-within:ring-[#D9F4F6]">

        {prefix && (
          <div className="flex items-center border-r border-[#E4EBED] bg-[#F7FAFB] px-3 text-sm text-[#84979D]">
            {prefix}
          </div>
        )}


        <input
          value={
            value
          }
          placeholder={
            placeholder
          }
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className="min-w-0 flex-1 bg-transparent px-3.5 text-sm text-[#173943] outline-none placeholder:text-[#A2B0B5]"
        />

      </div>

    </label>
  )
}


function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">

      <span className="mb-2 block text-sm font-semibold text-[#405E67]">
        {label}
      </span>

      <input
        type="date"
        value={
          value
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white px-3.5 text-sm text-[#173943] outline-none transition focus:border-[#77C9D0] focus:ring-2 focus:ring-[#D9F4F6]"
      />

    </label>
  )
}


function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">

      <span className="mb-2 block text-sm font-semibold text-[#405E67]">
        {label}
      </span>


      <div className="flex h-12 overflow-hidden rounded-xl border border-[#DCE6E8] bg-white focus-within:border-[#77C9D0] focus-within:ring-2 focus-within:ring-[#D9F4F6]">

        <div className="flex items-center border-r border-[#E4EBED] bg-[#F7FAFB] px-3 text-sm font-semibold text-[#71878E]">
          RM
        </div>

        <input
          type="number"
          min="0"
          step="0.01"
          value={
            value
          }
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className="min-w-0 flex-1 bg-transparent px-3.5 text-sm text-[#173943] outline-none"
        />

      </div>

    </label>
  )
}


function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">

      <span className="mb-2 block text-sm font-semibold text-[#405E67]">
        {label}
      </span>

      <input
        type="number"
        min="1"
        step="1"
        value={
          value
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white px-3.5 text-sm text-[#173943] outline-none transition focus:border-[#77C9D0] focus:ring-2 focus:ring-[#D9F4F6]"
      />

    </label>
  )
}


function ToggleOption({
  checked,
  title,
  description,
  icon: Icon,
  onChange,
}: {
  checked: boolean
  title: string
  description: string
  icon: typeof Camera
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(
          !checked
        )
      }
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
        checked
          ? "border-[#BFE3E6] bg-[#F1FAFA]"
          : "border-[#E1E9EB] bg-white hover:bg-[#FAFCFC]"
      }`}
    >

      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          checked
            ? "bg-[#DDF5F6] text-[#0B929E]"
            : "bg-[#F2F5F6] text-[#87999F]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>


      <div className="min-w-0 flex-1">

        <p className="text-sm font-semibold text-[#264750]">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-[#7B9097]">
          {description}
        </p>

      </div>


      <div
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked
            ? "bg-[#0A9CA8]"
            : "bg-[#D7E0E2]"
        }`}
      >

        <div
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            checked
              ? "left-6"
              : "left-1"
          }`}
        />

      </div>

    </button>
  )
}


function Divider() {
  return (
    <div className="h-px bg-[#E7EDEF]" />
  )
}


function formatMoney(
  value: number
) {
  return Number(
    value || 0
  ).toFixed(2)
}


function formatDate(
  value: string
) {
  const date =
    new Date(
      `${value}T00:00:00`
    )

  return date.toLocaleDateString(
    "en-MY",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  )
}