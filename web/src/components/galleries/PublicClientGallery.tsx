"use client"

import {
  ArrowLeft,
  CalendarDays,
  Download,
  Expand,
  Images,
  KeyRound,
  Loader2,
  LockKeyhole,
  X,
} from "lucide-react"

import {
  FormEvent,
  useState,
} from "react"


type PublicPhoto = {
  id: string

  filename: string

  content_type: string
  size_bytes: number

  width: number | null
  height: number | null

  sort_order: number

  is_cover: boolean

  view_url: string | null

  download_url:
    | string
    | null

  view_url_expires_in:
    | number
    | null
}


type GalleryData = {
  workspace: {
    id: string
    name: string
    slug: string
    domain: string
  }

  gallery: {
    id: string

    title: string
    slug: string

    client_name:
      | string
      | null

    description:
      | string
      | null

    shoot_date:
      | string
      | null

    privacy_mode:
      | "PUBLIC"
      | "PRIVATE"
      | "PASSWORD"

    allow_downloads:
      boolean

    allow_favourites:
      boolean

    expires_at:
      | string
      | null

    created_at: string
  }

  locked: boolean

  photos: PublicPhoto[]
}


export default function PublicClientGallery({
  workspaceSlug,
  gallerySlug,
  initialData,
  initialError,
}: {
  workspaceSlug: string
  gallerySlug: string

  initialData:
    | GalleryData
    | null

  initialError: string
}) {
  const [
    data,
    setData,
  ] = useState<
    GalleryData | null
  >(
    initialData
  )


  const [
    error,
    setError,
  ] = useState(
    initialError
  )


  const [
    password,
    setPassword,
  ] = useState("")


  const [
    unlocking,
    setUnlocking,
  ] = useState(false)


  const [
    selectedPhoto,
    setSelectedPhoto,
  ] = useState<
    PublicPhoto | null
  >(
    null
  )


  async function unlockGallery(
    event: FormEvent
  ) {
    event.preventDefault()

    setUnlocking(
      true
    )

    setError("")


    try {
      const apiUrl =
        process.env
          .NEXT_PUBLIC_API_URL ??
        "http://127.0.0.1:8000"


      const response =
        await fetch(
          `${apiUrl}` +
          `/api/public/galleries/` +
          `${encodeURIComponent(
            workspaceSlug
          )}/` +
          `${encodeURIComponent(
            gallerySlug
          )}/unlock`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                password,
              }),
          }
        )


      if (!response.ok) {
        let message =
          "Unable to unlock gallery."

        try {
          const body =
            await response.json()

          if (
            typeof body.detail ===
            "string"
          ) {
            message =
              body.detail
          }

        } catch {
          // Keep default.
        }

        throw new Error(
          message
        )
      }


      const unlocked =
        await response.json()


      setData(
        unlocked
      )

      setPassword("")

    } catch (unlockError) {
      setError(
        unlockError
          instanceof Error
          ? unlockError.message
          : "Unable to unlock gallery."
      )

    } finally {
      setUnlocking(
        false
      )
    }
  }


  if (
    error &&
    !data
  ) {
    return (
      <GalleryUnavailable
        message={
          error
        }
      />
    )
  }


  if (
    !data
  ) {
    return (
      <GalleryUnavailable
        message="Gallery unavailable."
      />
    )
  }


  if (
    data.locked
  ) {
    return (
      <PasswordScreen
        workspaceName={
          data.workspace.name
        }
        title={
          data.gallery.title
        }
        clientName={
          data.gallery.client_name
        }
        password={
          password
        }
        error={
          error
        }
        loading={
          unlocking
        }
        onPasswordChange={
          setPassword
        }
        onSubmit={
          unlockGallery
        }
      />
    )
  }


  const coverPhoto =
    data.photos.find(
      (photo) =>
        photo.is_cover &&
        photo.view_url
    ) ??
    data.photos.find(
      (photo) =>
        Boolean(
          photo.view_url
        )
    )


  return (
    <main className="min-h-screen bg-[#F8FAFA] text-[#173943]">

      {/* NAV */}
      <header className="border-b border-[#E5EBED] bg-white">

        <div className="mx-auto flex min-h-[76px] max-w-[1500px] items-center justify-between px-5 lg:px-8">

          <a
            href="/"
            className="text-lg font-semibold tracking-[-0.03em] text-[#123A46]"
          >
            {data.workspace.name}
          </a>


          <div className="flex items-center gap-2 text-xs font-semibold text-[#789097]">

            <Images className="h-4 w-4 text-[#0A9EAB]" />

            Client Gallery

          </div>

        </div>

      </header>


      {/* HERO */}
      <section className="relative overflow-hidden bg-[#102F39]">

        {coverPhoto?.view_url && (

          <img
            src={
              coverPhoto.view_url
            }
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />

        )}


        <div className="absolute inset-0 bg-gradient-to-r from-[#061D24]/90 via-[#0A2B35]/65 to-[#0A2B35]/25" />


        <div className="relative mx-auto flex min-h-[520px] max-w-[1500px] items-end px-5 py-14 lg:px-8 lg:py-20">

          <div className="max-w-3xl text-white">

            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#65DCE4]">
              Client Gallery
            </p>


            <h1 className="mt-4 text-[42px] font-semibold leading-[1.05] tracking-[-0.05em] sm:text-[58px]">
              {data.gallery.title}
            </h1>


            {data.gallery.client_name && (

              <p className="mt-5 text-lg text-white/80">
                {data.gallery.client_name}
              </p>

            )}


            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/70">

              {data.gallery.shoot_date && (

                <span className="flex items-center gap-2">

                  <CalendarDays className="h-4 w-4" />

                  {formatDate(
                    data.gallery
                      .shoot_date
                  )}

                </span>

              )}


              <span>
                {data.photos.length}{" "}
                {data.photos.length === 1
                  ? "photograph"
                  : "photographs"}
              </span>

            </div>

          </div>

        </div>

      </section>


      {/* INTRO */}
      {(data.gallery.description ||
        data.gallery.client_name) && (

        <section className="border-b border-[#E5EBED] bg-white">

          <div className="mx-auto max-w-[1050px] px-5 py-12 text-center lg:px-8 lg:py-16">

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0A929F]">
              Your photographs
            </p>


            {data.gallery.description ? (

              <p className="mx-auto mt-5 max-w-3xl text-[17px] leading-8 text-[#617981]">
                {
                  data.gallery
                    .description
                }
              </p>

            ) : (

              <p className="mx-auto mt-5 max-w-3xl text-[17px] leading-8 text-[#617981]">
                A collection prepared for{" "}
                {
                  data.gallery
                    .client_name
                }.
              </p>

            )}

          </div>

        </section>

      )}


      {/* PHOTOS */}
      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-5 lg:px-8 lg:py-12">

        {data.photos.length === 0 ? (

          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#D5E0E2] bg-white text-center">

            <Images className="h-8 w-8 text-[#9CB0B5]" />


            <h2 className="mt-5 text-xl font-semibold">
              No photographs yet
            </h2>


            <p className="mt-2 text-sm text-[#7A8E95]">
              The photographer has not added photographs to this gallery yet.
            </p>

          </div>

        ) : (

          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">

            {data.photos.map(
              (photo) => {

                if (
                  !photo.view_url
                ) {
                  return null
                }


                return (
                  <article
                    key={
                      photo.id
                    }
                    className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl bg-[#EAF0F1]"
                  >

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPhoto(
                          photo
                        )
                      }
                      className="block w-full"
                    >

                      <img
                        src={
                          photo.view_url
                        }
                        alt={
                          photo.filename
                        }
                        className="h-auto w-full transition duration-500 group-hover:scale-[1.015]"
                      />


                      <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />


                      <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-[#294B54] opacity-0 shadow-sm transition group-hover:opacity-100">

                        <Expand className="h-4 w-4" />

                      </div>

                    </button>


                    {data.gallery.allow_downloads &&
                      photo.download_url && (

                      <a
                        href={
                          photo.download_url
                        }
                        className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-[#294B54] opacity-0 shadow-sm transition group-hover:opacity-100"
                        aria-label={`Download ${photo.filename}`}
                      >

                        <Download className="h-4 w-4" />

                      </a>

                    )}

                  </article>
                )
              }
            )}

          </div>

        )}

      </section>


      {/* FOOTER */}
      <footer className="border-t border-[#E5EBED] bg-white">

        <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-[#85989E] sm:flex-row lg:px-8">

          <span>
            {data.workspace.name}
          </span>

          <span>
            Client gallery powered by EZFOTOO
          </span>

        </div>

      </footer>


      {/* FULLSCREEN VIEWER */}
      {selectedPhoto &&
        selectedPhoto.view_url && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#031015]/95 p-4 sm:p-8">

          <button
            type="button"
            aria-label="Close viewer"
            onClick={() =>
              setSelectedPhoto(
                null
              )
            }
            className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >

            <X className="h-5 w-5" />

          </button>


          <img
            src={
              selectedPhoto.view_url
            }
            alt={
              selectedPhoto.filename
            }
            className="max-h-[90vh] max-w-full object-contain"
          />


          {data.gallery.allow_downloads &&
            selectedPhoto.download_url && (

            <a
              href={
                selectedPhoto.download_url
              }
              className="absolute bottom-6 right-6 flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#173943]"
            >

              <Download className="h-4 w-4" />

              Download

            </a>

          )}

        </div>

      )}

    </main>
  )
}


function PasswordScreen({
  workspaceName,
  title,
  clientName,
  password,
  error,
  loading,
  onPasswordChange,
  onSubmit,
}: {
  workspaceName: string
  title: string

  clientName:
    | string
    | null

  password: string

  error: string

  loading: boolean

  onPasswordChange:
    (value: string) => void

  onSubmit:
    (event: FormEvent) => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F8F9] px-5">

      <div className="w-full max-w-[470px] rounded-[28px] border border-[#DCE7E9] bg-white p-7 shadow-[0_20px_60px_rgba(12,50,60,0.08)] sm:p-9">

        <div className="flex h-14 w-14 items-center justify-center rounded-[19px] bg-[#E6F8F9]">

          <LockKeyhole className="h-6 w-6 text-[#0794A1]" />

        </div>


        <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-[#0A929F]">
          {workspaceName}
        </p>


        <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-[#173943]">
          {title}
        </h1>


        {clientName && (

          <p className="mt-2 text-sm text-[#788D94]">
            Prepared for{" "}
            {clientName}
          </p>

        )}


        <p className="mt-6 text-sm leading-6 text-[#6F858C]">
          This gallery is password protected. Enter the password provided by your photographer.
        </p>


        <form
          onSubmit={
            onSubmit
          }
          className="mt-7"
        >

          <label className="mb-2 block text-sm font-semibold text-[#36535C]">
            Gallery password
          </label>


          <div className="relative">

            <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#82959B]" />


            <input
              type="password"
              required
              autoFocus
              value={
                password
              }
              onChange={(event) =>
                onPasswordChange(
                  event.target.value
                )
              }
              className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white pl-11 pr-4 text-sm text-[#203F48] outline-none transition focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
            />

          </div>


          {error && (

            <div className="mt-4 rounded-xl border border-[#F1D9DD] bg-[#FFF7F8] px-4 py-3 text-sm text-[#A54C58]">
              {error}
            </div>

          )}


          <button
            type="submit"
            disabled={
              loading
            }
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] font-semibold text-white transition hover:bg-[#0B5363] disabled:opacity-60"
          >

            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LockKeyhole className="h-4 w-4" />
            )}

            {loading
              ? "Opening gallery..."
              : "Open Gallery"}

          </button>

        </form>

      </div>

    </main>
  )
}


function GalleryUnavailable({
  message,
}: {
  message: string
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F8F9] px-5">

      <div className="max-w-md text-center">

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-sm">

          <LockKeyhole className="h-7 w-7 text-[#789097]" />

        </div>


        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.035em] text-[#173943]">
          Gallery unavailable
        </h1>


        <p className="mt-3 text-sm leading-6 text-[#71878E]">
          {message}
        </p>

      </div>

    </main>
  )
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
      month: "long",
      year: "numeric",
    }
  ).format(
    date
  )
}