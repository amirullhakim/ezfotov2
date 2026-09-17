"use client"

import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Heart,
  ImagePlus,
  Images,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
} from "lucide-react"

import { useRouter } from "next/navigation"

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
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


type GalleryPhoto = {
  id: string

  gallery_id: string
  workspace_id: string

  filename: string
  content_type: string

  size_bytes: number

  width: number | null
  height: number | null

  sort_order: number

  is_cover: boolean
  is_visible: boolean

  status: string

  view_url: string | null

  view_url_expires_in:
    | number
    | null

  created_at: string
  updated_at: string
}


type PhotosResponse = {
  gallery_id: string
  photos: GalleryPhoto[]
}


type WorkspaceResponse = {
  onboarded: boolean

  workspace: {
    id: string
    name: string
    slug: string

    domain: {
      hostname: string
      type: string
      verified: boolean
    } | null
  } | null
}


type PresignResponse = {
  upload_url: string
  object_key: string
  method: string

  headers: {
    [key: string]: string
  }
}


const MAX_FILE_SIZE =
  15 * 1024 * 1024


const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
]


export default function GalleryDetailManager({
  galleryId,
}: {
  galleryId: string
}) {
  const router = useRouter()

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    )


  const [
    gallery,
    setGallery,
  ] = useState<Gallery | null>(
    null
  )

  const [
    photos,
    setPhotos,
  ] = useState<GalleryPhoto[]>(
    []
  )

  const [
    workspaceHostname,
    setWorkspaceHostname,
  ] = useState("")


  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    uploading,
    setUploading,
  ] = useState(false)

  const [
    uploadProgress,
    setUploadProgress,
  ] = useState("")

  const [
    deletingPhotoId,
    setDeletingPhotoId,
  ] = useState<string | null>(
    null
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
    privateLink,
    setPrivateLink,
  ] = useState("")

  const [
    copiedLink,
    setCopiedLink,
  ] = useState(false)


  const [
    newPassword,
    setNewPassword,
  ] = useState("")

  const [
    changingPassword,
    setChangingPassword,
  ] = useState(false)


  const [
    title,
    setTitle,
  ] = useState("")

  const [
    clientName,
    setClientName,
  ] = useState("")

  const [
    description,
    setDescription,
  ] = useState("")

  const [
    shootDate,
    setShootDate,
  ] = useState("")

  const [
    allowDownloads,
    setAllowDownloads,
  ] = useState(true)

  const [
    allowFavourites,
    setAllowFavourites,
  ] = useState(true)


  useEffect(() => {
    async function loadGallery() {
      try {
        const [
          galleryResult,
          photosResult,
          workspaceResult,
        ] = await Promise.all([
          apiFetch<Gallery>(
            `/api/galleries/${galleryId}`
          ),

          apiFetch<PhotosResponse>(
            `/api/galleries/${galleryId}/photos`
          ),

          apiFetch<WorkspaceResponse>(
            "/api/workspaces/me"
          ),
        ])


        setGallery(
          galleryResult
        )

        setPhotos(
          photosResult.photos
        )


        setTitle(
          galleryResult.title
        )

        setClientName(
          galleryResult.client_name ??
          ""
        )

        setDescription(
          galleryResult.description ??
          ""
        )

        setShootDate(
          galleryResult.shoot_date ??
          ""
        )

        setAllowDownloads(
          galleryResult.allow_downloads
        )

        setAllowFavourites(
          galleryResult.allow_favourites
        )


        if (
          workspaceResult.workspace
        ) {
          setWorkspaceHostname(
            workspaceResult.workspace
              .domain?.hostname ??
            `${workspaceResult.workspace.slug}.ezfotoo.com`
          )
        }

      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load gallery."
        )

      } finally {
        setLoading(
          false
        )
      }
    }


    loadGallery()
  }, [galleryId])


  const totalSize =
    useMemo(
      () =>
        photos.reduce(
          (
            total,
            photo
          ) =>
            total +
            photo.size_bytes,
          0
        ),
      [photos]
    )


  const normalGalleryLink =
    gallery &&
    workspaceHostname
      ? `https://${workspaceHostname}/gallery/${gallery.slug}`
      : ""


  function clearMessages() {
    setErrorMessage("")
    setStatusMessage("")
  }


  async function copyLink(
    value: string
  ) {
    if (!value) {
      return
    }


    try {
      await navigator.clipboard.writeText(
        value
      )

      setCopiedLink(
        true
      )

      setTimeout(
        () => {
          setCopiedLink(
            false
          )
        },
        1800
      )

    } catch {
      setErrorMessage(
        "Unable to copy the gallery link automatically."
      )
    }
  }


  async function saveGallery() {
    if (!gallery) {
      return
    }


    setSaving(true)

    clearMessages()


    try {
      const updated =
        await apiFetch<Gallery>(
          `/api/galleries/${gallery.id}`,
          {
            method: "PATCH",

            body:
              JSON.stringify({
                title:
                  title.trim(),

                client_name:
                  clientName.trim()
                    ? clientName.trim()
                    : null,

                description:
                  description.trim()
                    ? description.trim()
                    : null,

                shoot_date:
                  shootDate ||
                  null,

                allow_downloads:
                  allowDownloads,

                allow_favourites:
                  allowFavourites,
              }),
          }
        )


      setGallery(
        updated
      )

      setStatusMessage(
        "Gallery saved."
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save gallery."
      )

    } finally {
      setSaving(
        false
      )
    }
  }


  async function togglePublished() {
    if (!gallery) {
      return
    }


    const nextPublished =
      !gallery.is_published


    setSaving(
      true
    )

    clearMessages()


    try {
      const updated =
        await apiFetch<Gallery>(
          `/api/galleries/${gallery.id}`,
          {
            method: "PATCH",

            body:
              JSON.stringify({
                is_published:
                  nextPublished,
              }),
          }
        )


      setGallery(
        updated
      )

      setStatusMessage(
        nextPublished
          ? "Gallery published."
          : "Gallery unpublished."
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update publishing status."
      )

    } finally {
      setSaving(
        false
      )
    }
  }


  async function regeneratePrivateLink() {
    if (
      !gallery ||
      gallery.privacy_mode !==
        "PRIVATE"
    ) {
      return
    }


    setSaving(
      true
    )

    clearMessages()

    setPrivateLink("")
    setCopiedLink(false)


    try {
      const updated =
        await apiFetch<Gallery>(
          `/api/galleries/${gallery.id}`,
          {
            method: "PATCH",

            body:
              JSON.stringify({
                regenerate_private_link:
                  true,
              }),
          }
        )


      setGallery(
        updated
      )


      if (
        updated.share_token &&
        workspaceHostname
      ) {
        const link =
          `https://${workspaceHostname}` +
          `/gallery/${updated.slug}` +
          `?t=${encodeURIComponent(
            updated.share_token
          )}`


        setPrivateLink(
          link
        )

        setStatusMessage(
          "A new private link was generated. The previous link is no longer valid."
        )
      }

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to regenerate private link."
      )

    } finally {
      setSaving(
        false
      )
    }
  }


  async function changeGalleryPassword() {
    if (
      !gallery ||
      gallery.privacy_mode !==
        "PASSWORD"
    ) {
      return
    }


    if (
      newPassword.length < 6
    ) {
      setErrorMessage(
        "New gallery password must contain at least 6 characters."
      )

      return
    }


    setChangingPassword(
      true
    )

    clearMessages()


    try {
      const updated =
        await apiFetch<Gallery>(
          `/api/galleries/${gallery.id}`,
          {
            method: "PATCH",

            body:
              JSON.stringify({
                password:
                  newPassword,
              }),
          }
        )


      setGallery(
        updated
      )

      setNewPassword(
        ""
      )

      setStatusMessage(
        "Gallery password changed successfully."
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to change gallery password."
      )

    } finally {
      setChangingPassword(
        false
      )
    }
  }


  async function handleFiles(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const selectedFiles =
      Array.from(
        event.target.files ??
        []
      )


    if (
      selectedFiles.length === 0
    ) {
      return
    }


    clearMessages()

    setUploading(
      true
    )


    try {
      for (
        let index = 0;
        index <
        selectedFiles.length;
        index += 1
      ) {
        const file =
          selectedFiles[index]


        setUploadProgress(
          `Uploading ${index + 1} of ${selectedFiles.length}: ${file.name}`
        )


        await uploadPhoto(
          file
        )
      }


      const refreshed =
        await apiFetch<PhotosResponse>(
          `/api/galleries/${galleryId}/photos`
        )


      setPhotos(
        refreshed.photos
      )


      setGallery(
        (current) =>
          current
            ? {
                ...current,

                photo_count:
                  refreshed.photos.length,
              }
            : current
      )


      setStatusMessage(
        `${selectedFiles.length} ${
          selectedFiles.length === 1
            ? "photo"
            : "photos"
        } uploaded successfully.`
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Photo upload failed."
      )

    } finally {
      setUploading(
        false
      )

      setUploadProgress(
        ""
      )


      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          ""
      }
    }
  }


  async function uploadPhoto(
    file: File
  ) {
    if (
      !ALLOWED_TYPES.includes(
        file.type
      )
    ) {
      throw new Error(
        `${file.name}: only JPEG, PNG and WebP are supported.`
      )
    }


    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      throw new Error(
        `${file.name}: image must be smaller than 15 MB.`
      )
    }


    const presigned =
      await apiFetch<PresignResponse>(
        `/api/galleries/${galleryId}/uploads/presign`,
        {
          method: "POST",

          body:
            JSON.stringify({
              filename:
                file.name,

              content_type:
                file.type,

              file_size:
                file.size,
            }),
        }
      )


    const uploadResponse =
      await fetch(
        presigned.upload_url,
        {
          method:
            presigned.method ||
            "PUT",

          headers:
            presigned.headers,

          body:
            file,
        }
      )


    if (
      !uploadResponse.ok
    ) {
      throw new Error(
        `${file.name}: upload to private storage failed.`
      )
    }


    const dimensions =
      await getImageDimensions(
        file
      )


    await apiFetch<GalleryPhoto>(
      `/api/galleries/${galleryId}/uploads/complete`,
      {
        method: "POST",

        body:
          JSON.stringify({
            object_key:
              presigned.object_key,

            filename:
              file.name,

            content_type:
              file.type,

            width:
              dimensions.width,

            height:
              dimensions.height,
          }),
      }
    )
  }


  async function deletePhoto(
    photo: GalleryPhoto
  ) {
    const confirmed =
      window.confirm(
        `Delete "${photo.filename}"?\n\nThis permanently removes the photo from this gallery and private storage.`
      )


    if (!confirmed) {
      return
    }


    setDeletingPhotoId(
      photo.id
    )

    clearMessages()


    try {
      await apiFetch<{
        ok: boolean
      }>(
        `/api/galleries/${galleryId}/photos/${photo.id}`,
        {
          method: "DELETE",
        }
      )


      const refreshed =
        await apiFetch<PhotosResponse>(
          `/api/galleries/${galleryId}/photos`
        )


      setPhotos(
        refreshed.photos
      )


      setGallery(
        (current) =>
          current
            ? {
                ...current,

                photo_count:
                  refreshed.photos.length,
              }
            : current
      )


      setStatusMessage(
        "Photo deleted."
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


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F9FA]">

        <div className="flex items-center gap-3 text-sm font-semibold text-[#58717A]">

          <Loader2 className="h-5 w-5 animate-spin text-[#0BA5B4]" />

          Loading gallery...

        </div>

      </div>
    )
  }


  if (!gallery) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F9FA]">

        <div className="text-center">

          <Images className="mx-auto h-8 w-8 text-[#9AADB3]" />

          <h1 className="mt-4 text-xl font-semibold text-[#173943]">
            Gallery unavailable
          </h1>

          <p className="mt-2 text-sm text-[#768B92]">
            {errorMessage ||
              "This gallery could not be loaded."}
          </p>


          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard/galleries"
              )
            }
            className="mt-6 rounded-xl bg-[#073B4C] px-5 py-3 text-sm font-semibold text-white"
          >
            Back to galleries
          </button>

        </div>

      </main>
    )
  }


  const privacy =
    getPrivacyPresentation(
      gallery.privacy_mode
    )

  const PrivacyIcon =
    privacy.icon


  return (
    <main className="min-h-screen bg-[#F5F8F9]">

      <header className="sticky top-0 z-30 border-b border-[#DFE8EA] bg-white/95 backdrop-blur">

        <div className="flex min-h-[76px] items-center justify-between gap-5 px-5 lg:px-8">

          <div className="flex min-w-0 items-center gap-4">

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/galleries"
                )
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E1EAEC] bg-white text-[#58717A] transition hover:bg-[#F4F8F9]"
            >

              <ArrowLeft className="h-4 w-4" />

            </button>


            <div className="min-w-0">

              <div className="flex items-center gap-2">

                <Images className="h-4 w-4 text-[#0A99A7]" />

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0A8D99]">
                  Client Gallery
                </p>

              </div>


              <h1 className="mt-1 truncate text-lg font-semibold tracking-[-0.025em] text-[#183A44]">
                {gallery.title}
              </h1>

            </div>

          </div>


          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={
                saveGallery
              }
              disabled={
                saving
              }
              className="hidden h-10 items-center gap-2 rounded-xl border border-[#DCE7E9] bg-white px-4 text-sm font-semibold text-[#36545D] transition hover:bg-[#F7FAFB] disabled:opacity-60 sm:flex"
            >

              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              Save

            </button>


            <button
              type="button"
              onClick={
                togglePublished
              }
              disabled={
                saving
              }
              className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                gallery.is_published
                  ? "bg-[#E3F5EF] text-[#187D62]"
                  : "bg-[#073B4C] text-white hover:bg-[#0B5363]"
              }`}
            >

              {gallery.is_published ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}

              {gallery.is_published
                ? "Published"
                : "Publish"}

            </button>

          </div>

        </div>

      </header>


      <div className="mx-auto max-w-[1450px] px-5 py-8 lg:px-8 lg:py-10">

        {(statusMessage ||
          errorMessage) && (

          <div
            className={`mb-7 rounded-2xl border px-5 py-4 text-sm font-semibold ${
              errorMessage
                ? "border-[#F1D9DD] bg-[#FFF7F8] text-[#A54C58]"
                : "border-[#CEE8E2] bg-[#F1FAF7] text-[#267B64]"
            }`}
          >
            {errorMessage ||
              statusMessage}
          </div>

        )}


        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">

          <div>

            <div className="flex flex-wrap items-center gap-2">

              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#607880] shadow-sm">

                <PrivacyIcon className="h-3.5 w-3.5" />

                {privacy.label}

              </span>


              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  gallery.is_published
                    ? "bg-[#E5F7F0] text-[#187F63]"
                    : "bg-white text-[#788C92]"
                }`}
              >
                {gallery.is_published
                  ? "Published"
                  : "Draft"}
              </span>

            </div>


            <h2 className="mt-5 text-[32px] font-semibold tracking-[-0.04em] text-[#112D38]">
              {gallery.title}
            </h2>


            <p className="mt-2 text-sm text-[#73888F]">
              {gallery.client_name ||
                "No client name"}
            </p>

          </div>


          <div className="flex flex-wrap gap-3">

            <MiniStat
              label="Photos"
              value={
                photos.length.toString()
              }
            />

            <MiniStat
              label="Storage"
              value={
                formatBytes(
                  totalSize
                )
              }
            />

          </div>

        </div>


        <div className="mt-8 grid gap-6 xl:grid-cols-[370px_1fr]">

          <aside className="space-y-6">

            <section className="rounded-[24px] border border-[#DFE8EA] bg-white p-6">

              <SectionHeader
                eyebrow="Details"
                title="Gallery information"
              />


              <div className="mt-6 space-y-5">

                <Field
                  label="Gallery title"
                  value={
                    title
                  }
                  onChange={
                    setTitle
                  }
                />


                <Field
                  label="Client name"
                  value={
                    clientName
                  }
                  onChange={
                    setClientName
                  }
                />


                <div>

                  <label className="mb-2 block text-sm font-semibold text-[#36535C]">
                    Shoot date
                  </label>


                  <div className="relative">

                    <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#82959B]" />

                    <input
                      type="date"
                      value={
                        shootDate
                      }
                      onChange={(event) =>
                        setShootDate(
                          event.target.value
                        )
                      }
                      className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white pl-11 pr-4 text-sm text-[#203F48] outline-none transition focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
                    />

                  </div>

                </div>


                <div>

                  <label className="mb-2 block text-sm font-semibold text-[#36535C]">
                    Description
                  </label>

                  <textarea
                    value={
                      description
                    }
                    rows={4}
                    placeholder="Optional message for your client..."
                    onChange={(event) =>
                      setDescription(
                        event.target.value
                      )
                    }
                    className="w-full resize-none rounded-xl border border-[#DCE6E8] bg-white px-4 py-3 text-sm leading-6 text-[#203F48] outline-none transition placeholder:text-[#A4B2B7] focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
                  />

                </div>


                <button
                  type="button"
                  onClick={
                    saveGallery
                  }
                  disabled={
                    saving
                  }
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:opacity-60"
                >

                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}

                  Save changes

                </button>

              </div>

            </section>


            <section className="rounded-[24px] border border-[#DFE8EA] bg-white p-6">

              <SectionHeader
                eyebrow="Access"
                title="Share & permissions"
              />


              <div className="mt-5 rounded-2xl border border-[#E3EBED] bg-[#F7FAFB] p-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E4ECEE] bg-white shadow-[0_2px_8px_rgba(20,55,65,0.04)]">

                    <PrivacyIcon className="h-4 w-4 text-[#0A929F]" />

                  </div>


                  <div className="min-w-0">

                    <p className="text-sm font-semibold text-[#294A53]">
                      {privacy.label}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#7B8F96]">
                      {getPrivacyDescription(
                        gallery.privacy_mode
                      )}
                    </p>

                  </div>

                </div>

              </div>


              {gallery.privacy_mode !==
                "PRIVATE" &&
                normalGalleryLink && (

                <div className="mt-5">

                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#84969D]">
                    Gallery link
                  </p>


                  <div className="mt-2 rounded-xl border border-[#DCE7E9] bg-[#F7FAFB] p-3">

                    <p className="break-all text-xs font-semibold leading-5 text-[#405F68]">
                      {normalGalleryLink}
                    </p>


                    <button
                      type="button"
                      onClick={() =>
                        copyLink(
                          normalGalleryLink
                        )
                      }
                      className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white text-xs font-semibold text-[#36555E] transition hover:bg-[#F1F6F7]"
                    >

                      {copiedLink ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#188366]" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy gallery link
                        </>
                      )}

                    </button>

                  </div>

                </div>

              )}


              {gallery.privacy_mode ===
                "PRIVATE" && (

                <div className="mt-5">

                  <button
                    type="button"
                    disabled={
                      saving
                    }
                    onClick={
                      regeneratePrivateLink
                    }
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#D9E5E7] bg-white text-sm font-semibold text-[#375861] transition hover:bg-[#F5F9FA] disabled:opacity-60"
                  >

                    <RefreshCw className="h-4 w-4" />

                    Generate private link

                  </button>


                  {privateLink && (

                    <div className="mt-4 rounded-xl border border-[#DCE7E9] bg-[#F7FAFB] p-3">

                      <p className="break-all text-xs font-semibold leading-5 text-[#405F68]">
                        {privateLink}
                      </p>


                      <button
                        type="button"
                        onClick={() =>
                          copyLink(
                            privateLink
                          )
                        }
                        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white text-xs font-semibold text-[#36555E] transition hover:bg-[#F1F6F7]"
                      >

                        {copiedLink ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[#188366]" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy private link
                          </>
                        )}

                      </button>

                    </div>

                  )}

                </div>

              )}


              {gallery.privacy_mode ===
                "PASSWORD" && (

                <div className="mt-5 border-t border-[#E9EFF0] pt-5">

                  <div className="flex items-center gap-2">

                    <KeyRound className="h-4 w-4 text-[#0A929F]" />

                    <p className="text-sm font-semibold text-[#36545D]">
                      Change gallery password
                    </p>

                  </div>


                  <input
                    type="password"
                    value={
                      newPassword
                    }
                    placeholder="New password, minimum 6 characters"
                    onChange={(event) =>
                      setNewPassword(
                        event.target.value
                      )
                    }
                    className="mt-4 h-11 w-full rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm text-[#203F48] outline-none transition placeholder:text-[#A4B2B7] focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
                  />


                  <button
                    type="button"
                    disabled={
                      changingPassword ||
                      newPassword.length < 6
                    }
                    onClick={
                      changeGalleryPassword
                    }
                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D9E5E7] bg-white text-sm font-semibold text-[#375861] transition hover:bg-[#F5F9FA] disabled:cursor-not-allowed disabled:opacity-50"
                  >

                    {changingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}

                    Change password

                  </button>

                </div>

              )}


              <div className="mt-5 border-t border-[#E9EFF0] pt-5">

                <div className="space-y-3">

                  <ToggleRow
                    icon={
                      Download
                    }
                    title="Downloads"
                    checked={
                      allowDownloads
                    }
                    onChange={
                      setAllowDownloads
                    }
                  />


                  <ToggleRow
                    icon={
                      Heart
                    }
                    title="Favourites"
                    checked={
                      allowFavourites
                    }
                    onChange={
                      setAllowFavourites
                    }
                  />

                </div>

              </div>

            </section>

          </aside>


          <section className="rounded-[26px] border border-[#DFE8EA] bg-white">

            <div className="flex flex-col justify-between gap-5 border-b border-[#E9EFF0] p-6 sm:flex-row sm:items-center">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A929F]">
                  Photographs
                </p>

                <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#173943]">
                  Gallery photos
                </h3>

                <p className="mt-1 text-sm text-[#7A8E95]">
                  Upload JPEG, PNG or WebP images up to 15 MB each.
                </p>

              </div>


              <div>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={
                    handleFiles
                  }
                  className="hidden"
                />


                <button
                  type="button"
                  disabled={
                    uploading
                  }
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  className="flex h-11 items-center gap-2 rounded-xl bg-[#073B4C] px-5 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}

                  {uploading
                    ? "Uploading..."
                    : "Upload photos"}

                </button>

              </div>

            </div>


            {uploading &&
              uploadProgress && (

              <div className="border-b border-[#E9EFF0] bg-[#F5FAFA] px-6 py-4">

                <div className="flex items-center gap-3 text-sm font-semibold text-[#477079]">

                  <Loader2 className="h-4 w-4 animate-spin text-[#0A9EAB]" />

                  {uploadProgress}

                </div>

              </div>

            )}


            {photos.length === 0 ? (

              <div className="flex min-h-[480px] flex-col items-center justify-center px-6 text-center">

                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#EAF8F9]">

                  <ImagePlus className="h-7 w-7 text-[#0A9EAB]" />

                </div>


                <h4 className="mt-6 text-xl font-semibold text-[#173943]">
                  No photographs yet
                </h4>


                <p className="mt-2 max-w-md text-sm leading-6 text-[#778C93]">
                  Upload your first photographs. The first image automatically becomes the gallery cover.
                </p>


                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  className="mt-6 flex h-11 items-center gap-2 rounded-xl bg-[#073B4C] px-5 text-sm font-semibold text-white"
                >

                  <UploadCloud className="h-4 w-4" />

                  Upload photographs

                </button>

              </div>

            ) : (

              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">

                {photos.map(
                  (photo) => (

                    <article
                      key={
                        photo.id
                      }
                      className="group overflow-hidden rounded-2xl border border-[#E1E9EB] bg-[#F6F9FA]"
                    >

                      <div className="relative aspect-[4/3] overflow-hidden bg-[#EAF0F1]">

                        {photo.view_url ? (

                          <img
                            src={
                              photo.view_url
                            }
                            alt={
                              photo.filename
                            }
                            className="h-full w-full object-cover"
                          />

                        ) : (

                          <div className="flex h-full items-center justify-center">

                            <Images className="h-7 w-7 text-[#9DB0B6]" />

                          </div>

                        )}


                        {photo.is_cover && (

                          <span className="absolute left-3 top-3 rounded-full bg-[#073B4C]/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur">
                            Cover
                          </span>

                        )}


                        <button
                          type="button"
                          disabled={
                            deletingPhotoId ===
                            photo.id
                          }
                          onClick={() =>
                            deletePhoto(
                              photo
                            )
                          }
                          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-[#A44D57] opacity-0 shadow-sm transition group-hover:opacity-100 disabled:opacity-50"
                        >

                          {deletingPhotoId ===
                          photo.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}

                        </button>

                      </div>


                      <div className="p-3">

                        <p className="truncate text-xs font-semibold text-[#36555E]">
                          {photo.filename}
                        </p>

                        <p className="mt-1 text-[10px] text-[#889A9F]">
                          {formatBytes(
                            photo.size_bytes
                          )}
                        </p>

                      </div>

                    </article>

                  )
                )}

              </div>

            )}

          </section>

        </div>

      </div>

    </main>
  )
}


function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return (
    <div>

      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A929F]">
        {eyebrow}
      </p>

      <h3 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-[#173943]">
        {title}
      </h3>

    </div>
  )
}


function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (
    value: string
  ) => void
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-semibold text-[#36535C]">
        {label}
      </label>

      <input
        value={
          value
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm text-[#203F48] outline-none transition focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
      />

    </div>
  )
}


function ToggleRow({
  icon: Icon,
  title,
  checked,
  onChange,
}: {
  icon: typeof Download
  title: string
  checked: boolean
  onChange: (
    value: boolean
  ) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E3EAEC] p-3">

      <div className="flex items-center gap-3">

        <Icon className="h-4 w-4 text-[#648088]" />

        <p className="text-sm font-semibold text-[#36545D]">
          {title}
        </p>

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


function MiniStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-[115px] rounded-2xl border border-[#E0E8EA] bg-white px-4 py-3">

      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8B9CA2]">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-[#21434C]">
        {value}
      </p>

    </div>
  )
}


function getPrivacyDescription(
  mode: PrivacyMode
) {
  if (
    mode === "PUBLIC"
  ) {
    return (
      "Anyone with the gallery link can view this gallery."
    )
  }


  if (
    mode === "PASSWORD"
  ) {
    return (
      "Visitors must enter the gallery password before viewing."
    )
  }


  return (
    "Only people with the private share link can access this gallery."
  )
}


function getPrivacyPresentation(
  mode: PrivacyMode
) {
  if (
    mode === "PUBLIC"
  ) {
    return {
      label: "Public gallery",
      icon: Eye,
    }
  }


  if (
    mode === "PASSWORD"
  ) {
    return {
      label: "Password protected",
      icon: LockKeyhole,
    }
  }


  return {
    label: "Private gallery",
    icon: Link2,
  }
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
    1024 * 1024 * 1024
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


function getImageDimensions(
  file: File
): Promise<{
  width: number | null
  height: number | null
}> {
  return new Promise(
    (resolve) => {
      const image =
        new Image()

      const objectUrl =
        URL.createObjectURL(
          file
        )


      image.onload = () => {
        resolve({
          width:
            image.naturalWidth,

          height:
            image.naturalHeight,
        })

        URL.revokeObjectURL(
          objectUrl
        )
      }


      image.onerror = () => {
        resolve({
          width: null,
          height: null,
        })

        URL.revokeObjectURL(
          objectUrl
        )
      }


      image.src =
        objectUrl
    }
  )
}