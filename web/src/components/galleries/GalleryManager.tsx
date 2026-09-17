"use client"

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Heart,
  Images,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
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


type PrivacyMode =
  | "PUBLIC"
  | "PRIVATE"
  | "PASSWORD"


type Gallery = {
  id: string
  workspace_id: string

  title: string
  slug: string

  client_name: string | null
  description: string | null

  shoot_date: string | null

  privacy_mode: PrivacyMode

  password_configured: boolean
  private_link_configured: boolean

  allow_downloads: boolean
  allow_favourites: boolean

  is_published: boolean

  expires_at: string | null

  photo_count: number

  share_token: string | null

  created_at: string
  updated_at: string
}


type GalleriesResponse = {
  galleries: Gallery[]
}


type TrashResponse = {
  retention_days: number
  galleries: {
    id: string
  }[]
}


type WorkspaceResponse = {
  onboarded: boolean

  workspace: {
    id: string
    name: string
    slug: string
  } | null
}


type CreateForm = {
  title: string
  slug: string
  clientName: string
  shootDate: string

  privacyMode: PrivacyMode
  password: string

  allowDownloads: boolean
  allowFavourites: boolean

  expiryDate: string
}


const emptyForm: CreateForm = {
  title: "",
  slug: "",
  clientName: "",
  shootDate: "",

  privacyMode: "PRIVATE",
  password: "",

  allowDownloads: true,
  allowFavourites: true,

  expiryDate: "",
}


export default function GalleryManager() {
  const router = useRouter()

  const [
    galleries,
    setGalleries,
  ] = useState<Gallery[]>([])

  const [
    workspaceSlug,
    setWorkspaceSlug,
  ] = useState("")

  const [
    trashCount,
    setTrashCount,
  ] = useState(0)

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

  const [
    newPrivateLink,
    setNewPrivateLink,
  ] = useState("")

  const [
    copied,
    setCopied,
  ] = useState(false)


  useEffect(() => {
    async function loadPage() {
      try {
        const [
          galleryResult,
          workspaceResult,
        ] = await Promise.all([
          apiFetch<GalleriesResponse>(
            "/api/galleries"
          ),

          apiFetch<WorkspaceResponse>(
            "/api/workspaces/me"
          ),
        ])

        setGalleries(
          galleryResult.galleries
        )

        try {
          const trashResult =
            await apiFetch<TrashResponse>(
              "/api/galleries/trash/items"
            )

          setTrashCount(
            trashResult.galleries.length
          )
        } catch {
          // Trash count is helpful but should never
          // block the main gallery manager.
          setTrashCount(0)
        }

        if (
          workspaceResult.workspace
        ) {
          setWorkspaceSlug(
            workspaceResult
              .workspace
              .slug
          )
        }

      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load client galleries."
        )

      } finally {
        setLoading(false)
      }
    }

    loadPage()
  }, [])


  const publishedCount =
    useMemo(
      () =>
        galleries.filter(
          (gallery) =>
            gallery.is_published
        ).length,
      [galleries]
    )


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
      (current) => ({
        ...current,

        title: value,

        slug:
          current.slug ===
            slugify(
              current.title
            ) ||
          current.slug === ""
            ? slugify(value)
            : current.slug,
      })
    )

    setErrorMessage("")
  }


  function resetCreateForm() {
    setForm(
      emptyForm
    )

    setNewPrivateLink("")
    setErrorMessage("")
    setStatusMessage("")
    setCopied(false)
  }


  function closeCreatePanel() {
    setShowCreate(false)

    resetCreateForm()
  }


  async function createGallery(
    event: FormEvent
  ) {
    event.preventDefault()

    setCreating(true)
    setErrorMessage("")
    setStatusMessage("")
    setNewPrivateLink("")
    setCopied(false)

    try {
      if (
        !form.title.trim()
      ) {
        throw new Error(
          "Gallery title is required."
        )
      }

      if (
        form.privacyMode ===
          "PASSWORD" &&
        form.password.length < 6
      ) {
        throw new Error(
          "Password must contain at least 6 characters."
        )
      }


      let expiresAt:
        string | null = null

      if (
        form.expiryDate
      ) {
        const date =
          new Date(
            `${form.expiryDate}T23:59:59`
          )

        expiresAt =
          date.toISOString()
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

        client_name:
          form.clientName.trim()
            ? form.clientName.trim()
            : null,

        description:
          null,

        shoot_date:
          form.shootDate ||
          null,

        privacy_mode:
          form.privacyMode,

        password:
          form.privacyMode ===
            "PASSWORD"
            ? form.password
            : null,

        allow_downloads:
          form.allowDownloads,

        allow_favourites:
          form.allowFavourites,

        is_published:
          false,

        expires_at:
          expiresAt,
      }


      const created =
        await apiFetch<Gallery>(
          "/api/galleries",
          {
            method: "POST",

            body:
              JSON.stringify(
                payload
              ),
          }
        )


      setGalleries(
        (current) => [
          created,
          ...current,
        ]
      )


      if (
        created.privacy_mode ===
          "PRIVATE" &&
        created.share_token &&
        workspaceSlug
      ) {
        const hostname =
          `${workspaceSlug}.ezfotoo.com`

        const link =
          `https://${hostname}` +
          `/gallery/${created.slug}` +
          `?t=${encodeURIComponent(
            created.share_token
          )}`

        setNewPrivateLink(
          link
        )

        setStatusMessage(
          "Gallery created. Copy the private link before closing this panel."
        )

        setForm(
          emptyForm
        )

        return
      }


      setStatusMessage(
        "Gallery created successfully."
      )

      setForm(
        emptyForm
      )

      setTimeout(
        () => {
          setShowCreate(
            false
          )

          setStatusMessage(
            ""
          )
        },
        700
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create gallery."
      )

    } finally {
      setCreating(false)
    }
  }


  async function deleteGallery(
    gallery: Gallery
  ) {
    const confirmed =
      window.confirm(
        `Move "${gallery.title}" to Trash?\n\nThe gallery will become unavailable to clients, but you can restore it within 30 days.`
      )

    if (!confirmed) {
      return
    }

    setDeletingId(
      gallery.id
    )

    setErrorMessage("")
    setStatusMessage("")

    try {
      await apiFetch<{
        ok: boolean
        trashed: boolean
      }>(
        `/api/galleries/${gallery.id}`,
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

      setTrashCount(
        (current) =>
          current + 1
      )

      setStatusMessage(
        "Gallery moved to Trash. You can restore it within 30 days."
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to move gallery to Trash."
      )

    } finally {
      setDeletingId(
        null
      )
    }
  }


  async function copyPrivateLink() {
    if (
      !newPrivateLink
    ) {
      return
    }

    try {
      await navigator
        .clipboard
        .writeText(
          newPrivateLink
        )

      setCopied(true)

      setTimeout(
        () => {
          setCopied(
            false
          )
        },
        1800
      )

    } catch {
      setErrorMessage(
        "Unable to copy the link automatically. Select and copy it manually."
      )
    }
  }


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F9FA]">

        <div className="flex items-center gap-3 text-sm font-semibold text-[#58717A]">

          <Loader2 className="h-5 w-5 animate-spin text-[#0BA5B4]" />

          Loading client galleries...

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

                <Images className="h-4 w-4 text-[#0A99A7]" />

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0A8D99]">
                  Client Gallery
                </p>

              </div>


              <h1 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#183A44]">
                Gallery Manager
              </h1>

            </div>

          </div>


          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/galleries/trash"
                )
              }
              className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE6E8] bg-white px-3.5 text-sm font-semibold text-[#526D75] transition hover:bg-[#F5F8F9]"
            >

              <Trash2 className="h-4 w-4" />

              <span className="hidden sm:inline">
                Trash
              </span>

              {trashCount > 0 && (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-[#EDF3F4] px-1.5 py-0.5 text-[10px] font-bold text-[#607880]">
                  {trashCount}
                </span>
              )}

            </button>


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
                New gallery
              </span>

              <span className="sm:hidden">
                New
              </span>

            </button>

          </div>

        </div>

      </header>


      {/* PAGE */}
      <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8 lg:py-10">

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

          <div>

            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">
              Client delivery
            </p>

            <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#112D38]">
              Your galleries
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6D8289]">
              Create private spaces for your clients to view, favourite and download their photographs.
            </p>

          </div>


          <div className="flex flex-wrap gap-3">

            <MiniStat
              label="Galleries"
              value={
                galleries.length.toString()
              }
            />

            <MiniStat
              label="Published"
              value={
                publishedCount.toString()
              }
            />

            <MiniStat
              label="Photos"
              value={
                totalPhotos.toString()
              }
            />

            <MiniStat
              label="Trash"
              value={
                trashCount.toString()
              }
            />

          </div>

        </div>


        {(errorMessage ||
          statusMessage) && (

          <div
            className={`mt-7 rounded-2xl border px-5 py-4 text-sm font-semibold ${
              errorMessage
                ? "border-[#F1D9DD] bg-[#FFF7F8] text-[#A54C58]"
                : "border-[#CEE8E2] bg-[#F1FAF7] text-[#267B64]"
            }`}
          >
            {
              errorMessage ||
              statusMessage
            }
          </div>

        )}


        {galleries.length === 0 ? (

          <EmptyState
            onCreate={() => {
              resetCreateForm()
              setShowCreate(true)
            }}
          />

        ) : (

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">

            {galleries.map(
              (gallery) => (

                <GalleryCard
                  key={
                    gallery.id
                  }
                  gallery={
                    gallery
                  }
                  deleting={
                    deletingId ===
                    gallery.id
                  }
                  onManage={() =>
                    router.push(
                      `/dashboard/galleries/${gallery.id}`
                    )
                  }
                  onDelete={() =>
                    deleteGallery(
                      gallery
                    )
                  }
                />

              )
            )}

          </div>

        )}

      </div>


      {showCreate && (

        <div className="fixed inset-0 z-50 flex items-start justify-end bg-[#071F27]/35 backdrop-blur-[2px]">

          <button
            type="button"
            aria-label="Close create gallery"
            onClick={
              closeCreatePanel
            }
            className="absolute inset-0"
          />


          <section className="relative z-10 h-full w-full overflow-y-auto bg-white shadow-2xl sm:max-w-[560px]">

            <div className="sticky top-0 z-10 flex min-h-[76px] items-center justify-between border-b border-[#E4EBED] bg-white/95 px-6 backdrop-blur">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A929F]">
                  New client delivery
                </p>

                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#163741]">
                  Create gallery
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
                createGallery
              }
              className="space-y-8 p-6 pb-12"
            >

              {newPrivateLink ? (

                <PrivateLinkCreated
                  link={
                    newPrivateLink
                  }
                  copied={
                    copied
                  }
                  onCopy={
                    copyPrivateLink
                  }
                  onDone={() => {
                    setShowCreate(
                      false
                    )

                    resetCreateForm()
                  }}
                />

              ) : (
                <>

                  <FormSection
                    eyebrow="Details"
                    title="Gallery information"
                    description="Give the gallery a clear name your client will recognise."
                  />


                  <Field
                    label="Gallery title"
                    value={
                      form.title
                    }
                    placeholder="Alya & Danish Wedding"
                    onChange={
                      handleTitleChange
                    }
                  />


                  <Field
                    label="Client name"
                    value={
                      form.clientName
                    }
                    placeholder="Alya & Danish"
                    onChange={(value) =>
                      updateForm(
                        "clientName",
                        value
                      )
                    }
                  />


                  <Field
                    label="Gallery address"
                    value={
                      form.slug
                    }
                    placeholder="alya-danish-wedding"
                    prefix="/gallery/"
                    onChange={(value) =>
                      updateForm(
                        "slug",
                        slugify(
                          value
                        )
                      )
                    }
                  />


                  <DateField
                    label="Shoot date"
                    value={
                      form.shootDate
                    }
                    onChange={(value) =>
                      updateForm(
                        "shootDate",
                        value
                      )
                    }
                  />


                  <Divider />


                  <FormSection
                    eyebrow="Access"
                    title="Who can view it?"
                    description="Choose how clients will enter this gallery."
                  />


                  <div className="space-y-3">

                    <PrivacyOption
                      mode="PUBLIC"
                      selected={
                        form.privacyMode ===
                        "PUBLIC"
                      }
                      icon={
                        Eye
                      }
                      title="Public"
                      description="Anyone with the gallery address can open it."
                      onClick={() =>
                        updateForm(
                          "privacyMode",
                          "PUBLIC"
                        )
                      }
                    />


                    <PrivacyOption
                      mode="PRIVATE"
                      selected={
                        form.privacyMode ===
                        "PRIVATE"
                      }
                      icon={
                        Link2
                      }
                      title="Private link"
                      description="Only people with the secret share link can access it."
                      recommended
                      onClick={() =>
                        updateForm(
                          "privacyMode",
                          "PRIVATE"
                        )
                      }
                    />


                    <PrivacyOption
                      mode="PASSWORD"
                      selected={
                        form.privacyMode ===
                        "PASSWORD"
                      }
                      icon={
                        KeyRound
                      }
                      title="Password protected"
                      description="Visitors must enter the gallery password."
                      onClick={() =>
                        updateForm(
                          "privacyMode",
                          "PASSWORD"
                        )
                      }
                    />

                  </div>


                  {form.privacyMode ===
                    "PASSWORD" && (

                    <Field
                      label="Gallery password"
                      type="password"
                      value={
                        form.password
                      }
                      placeholder="Minimum 6 characters"
                      onChange={(value) =>
                        updateForm(
                          "password",
                          value
                        )
                      }
                    />

                  )}


                  <Divider />


                  <FormSection
                    eyebrow="Client experience"
                    title="Gallery permissions"
                    description="Control what clients can do inside this gallery."
                  />


                  <ToggleRow
                    icon={
                      Download
                    }
                    title="Allow downloads"
                    description="Clients can download photos from this gallery."
                    checked={
                      form.allowDownloads
                    }
                    onChange={(value) =>
                      updateForm(
                        "allowDownloads",
                        value
                      )
                    }
                  />


                  <ToggleRow
                    icon={
                      Heart
                    }
                    title="Allow favourites"
                    description="Clients can mark photographs they love."
                    checked={
                      form.allowFavourites
                    }
                    onChange={(value) =>
                      updateForm(
                        "allowFavourites",
                        value
                      )
                    }
                  />


                  <Divider />


                  <FormSection
                    eyebrow="Availability"
                    title="Gallery expiry"
                    description="Optional. After this date the gallery will no longer be available to clients."
                  />


                  <DateField
                    label="Expiry date"
                    value={
                      form.expiryDate
                    }
                    min={
                      new Date()
                        .toISOString()
                        .split("T")[0]
                    }
                    onChange={(value) =>
                      updateForm(
                        "expiryDate",
                        value
                      )
                    }
                  />


                  {errorMessage && (

                    <div className="rounded-xl border border-[#F1D9DD] bg-[#FFF7F8] px-4 py-3 text-sm font-semibold text-[#A54C58]">
                      {errorMessage}
                    </div>

                  )}


                  <button
                    type="submit"
                    disabled={
                      creating
                    }
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}

                    {creating
                      ? "Creating gallery..."
                      : "Create Gallery"}

                  </button>

                </>
              )}

            </form>

          </section>

        </div>

      )}

    </main>
  )
}


function GalleryCard({
  gallery,
  deleting,
  onManage,
  onDelete,
}: {
  gallery: Gallery
  deleting: boolean
  onManage: () => void
  onDelete: () => void
}) {
  const privacy =
    getPrivacyPresentation(
      gallery.privacy_mode
    )

  const PrivacyIcon =
    privacy.icon

  return (
    <article className="overflow-hidden rounded-[24px] border border-[#DFE8EA] bg-white shadow-[0_12px_35px_rgba(20,55,65,0.04)]">

      <div className="flex aspect-[16/8.7] items-center justify-center bg-[linear-gradient(135deg,#EAF7F8,#F7FAFB_55%,#E8F1F2)]">

        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/80 bg-white/80 shadow-sm">

          <Images className="h-7 w-7 text-[#0A9EAB]" />

        </div>

      </div>


      <div className="p-5">

        <div className="flex items-start justify-between gap-4">

          <div className="min-w-0">

            <h3 className="truncate text-lg font-semibold tracking-[-0.025em] text-[#173943]">
              {gallery.title}
            </h3>

            <p className="mt-1 truncate text-sm text-[#7A8F96]">
              {gallery.client_name ||
                "No client name"}
            </p>

          </div>


          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
              gallery.is_published
                ? "bg-[#E5F7F0] text-[#187F63]"
                : "bg-[#F0F3F4] text-[#788C92]"
            }`}
          >
            {gallery.is_published
              ? "Published"
              : "Draft"}
          </span>

        </div>


        <div className="mt-5 flex flex-wrap gap-2">

          <span className="flex items-center gap-1.5 rounded-full bg-[#F3F7F8] px-3 py-1.5 text-xs font-semibold text-[#607880]">

            <PrivacyIcon className="h-3.5 w-3.5" />

            {privacy.label}

          </span>


          <span className="flex items-center gap-1.5 rounded-full bg-[#F3F7F8] px-3 py-1.5 text-xs font-semibold text-[#607880]">

            <Images className="h-3.5 w-3.5" />

            {gallery.photo_count}{" "}
            {gallery.photo_count === 1
              ? "photo"
              : "photos"}

          </span>

        </div>


        {gallery.shoot_date && (

          <div className="mt-4 flex items-center gap-2 text-xs text-[#7B8F96]">

            <CalendarDays className="h-3.5 w-3.5" />

            {formatDate(
              gallery.shoot_date
            )}

          </div>

        )}


        <div className="mt-5 flex items-center gap-2 border-t border-[#EDF1F2] pt-4">

          <button
            type="button"
            onClick={
              onManage
            }
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#073B4C] text-sm font-semibold text-white transition hover:bg-[#0B5363]"
          >

            Manage

            <ChevronRight className="h-4 w-4" />

          </button>


          <button
            type="button"
            title="Move to Trash"
            aria-label={`Move ${gallery.title} to Trash`}
            onClick={
              onDelete
            }
            disabled={
              deleting
            }
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


function EmptyState({
  onCreate,
}: {
  onCreate: () => void
}) {
  return (
    <div className="mt-8 flex min-h-[430px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#CFDDE0] bg-white px-6 text-center">

      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#E9F8F9]">

        <FolderOpen className="h-7 w-7 text-[#0A9EAB]" />

      </div>


      <h3 className="mt-6 text-xl font-semibold tracking-[-0.025em] text-[#173943]">
        No client galleries yet
      </h3>


      <p className="mt-2 max-w-md text-sm leading-6 text-[#778C93]">
        Create your first gallery to privately deliver photographs to a client.
      </p>


      <button
        type="button"
        onClick={
          onCreate
        }
        className="mt-6 flex h-11 items-center gap-2 rounded-xl bg-[#073B4C] px-5 text-sm font-semibold text-white transition hover:bg-[#0B5363]"
      >

        <Plus className="h-4 w-4" />

        Create your first gallery

      </button>

    </div>
  )
}


function PrivateLinkCreated({
  link,
  copied,
  onCopy,
  onDone,
}: {
  link: string
  copied: boolean
  onCopy: () => void
  onDone: () => void
}) {
  return (
    <div className="py-5">

      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#E7F7F1]">

        <ShieldCheck className="h-6 w-6 text-[#188366]" />

      </div>


      <h3 className="mt-6 text-2xl font-semibold tracking-[-0.035em] text-[#173943]">
        Private gallery created
      </h3>


      <p className="mt-3 text-sm leading-6 text-[#70868D]">
        This secret link is shown when it is generated. Copy it before closing this panel. You can generate a new private link later if needed.
      </p>


      <div className="mt-7 rounded-2xl border border-[#DCE7E9] bg-[#F8FAFB] p-4">

        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#82949A]">
          Private share link
        </p>


        <p className="mt-3 break-all text-sm font-semibold leading-6 text-[#254750]">
          {link}
        </p>


        <button
          type="button"
          onClick={
            onCopy
          }
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D6E2E4] bg-white text-sm font-semibold text-[#375861] transition hover:bg-[#F2F7F8]"
        >

          {copied ? (
            <>
              <Check className="h-4 w-4 text-[#188366]" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy private link
            </>
          )}

        </button>

      </div>


      <button
        type="button"
        onClick={
          onDone
        }
        className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-[#073B4C] font-semibold text-white transition hover:bg-[#0B5363]"
      >
        Done
      </button>

    </div>
  )
}


function PrivacyOption({
  selected,
  icon: Icon,
  title,
  description,
  recommended,
  onClick,
}: {
  mode: PrivacyMode
  selected: boolean
  icon: typeof Eye
  title: string
  description: string
  recommended?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-[#68D3DB] bg-[#F1FBFB] ring-2 ring-[#1CC9D8]/10"
          : "border-[#E0E8EA] bg-white hover:border-[#C7DADD]"
      }`}
    >

      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          selected
            ? "bg-[#DDF7F8] text-[#078B98]"
            : "bg-[#F3F6F7] text-[#71878E]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>


      <div className="min-w-0 flex-1">

        <div className="flex items-center gap-2">

          <p className="text-sm font-semibold text-[#294A53]">
            {title}
          </p>

          {recommended && (
            <span className="rounded-full bg-[#E2F5F6] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#078995]">
              Recommended
            </span>
          )}

        </div>


        <p className="mt-1 text-xs leading-5 text-[#7B8F96]">
          {description}
        </p>

      </div>


      <div
        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected
            ? "border-[#0AA4B1] bg-[#0AA4B1]"
            : "border-[#CAD6D9]"
        }`}
      >

        {selected && (
          <Check className="h-3 w-3 text-white" />
        )}

      </div>

    </button>
  )
}


function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: typeof Download
  title: string
  description: string
  checked: boolean
  onChange: (
    value: boolean
  ) => void
}) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-2xl border border-[#E2E9EB] p-4">

      <div className="flex items-start gap-3">

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F7F8] text-[#4F747D]">

          <Icon className="h-4 w-4" />

        </div>


        <div>

          <p className="text-sm font-semibold text-[#31515A]">
            {title}
          </p>

          <p className="mt-1 text-xs leading-5 text-[#809299]">
            {description}
          </p>

        </div>

      </div>


      <button
        type="button"
        role="switch"
        aria-checked={
          checked
        }
        onClick={() =>
          onChange(
            !checked
          )
        }
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked
            ? "bg-[#0AA4B1]"
            : "bg-[#D5DEE0]"
        }`}
      >

        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked
              ? "left-6"
              : "left-1"
          }`}
        />

      </button>

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

      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A929F]">
        {eyebrow}
      </p>

      <h3 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-[#173943]">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[#788C93]">
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
  type = "text",
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  prefix?: string
  type?: string
  onChange: (
    value: string
  ) => void
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-semibold text-[#36535C]">
        {label}
      </label>


      <div className="flex h-12 overflow-hidden rounded-xl border border-[#DCE6E8] bg-white transition focus-within:border-[#2CC3D0] focus-within:ring-4 focus-within:ring-[#1CC9D8]/10">

        {prefix && (
          <div className="flex items-center border-r border-[#E3EAEC] bg-[#F6F9FA] px-3 text-xs font-semibold text-[#82949A]">
            {prefix}
          </div>
        )}


        <input
          type={
            type
          }
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
          className="min-w-0 flex-1 bg-transparent px-4 text-sm text-[#203F48] outline-none placeholder:text-[#A4B2B7]"
        />

      </div>

    </div>
  )
}


function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: string
  min?: string
  onChange: (
    value: string
  ) => void
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-semibold text-[#36535C]">
        {label}
      </label>

      <div className="relative">

        <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#82959B]" />

        <input
          type="date"
          value={
            value
          }
          min={
            min
          }
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white pl-11 pr-4 text-sm text-[#203F48] outline-none transition focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
        />

      </div>

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


function Divider() {
  return (
    <div className="border-t border-[#E9EFF0]" />
  )
}


function getPrivacyPresentation(
  mode: PrivacyMode
) {
  if (
    mode === "PUBLIC"
  ) {
    return {
      label: "Public",
      icon: Eye,
    }
  }

  if (
    mode === "PASSWORD"
  ) {
    return {
      label: "Password",
      icon: LockKeyhole,
    }
  }

  return {
    label: "Private",
    icon: Link2,
  }
}


function formatDate(
  value: string
) {
  const date =
    new Date(
      `${value}T00:00:00`
    )

  return new Intl.DateTimeFormat(
    "en-MY",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(
    date
  )
}