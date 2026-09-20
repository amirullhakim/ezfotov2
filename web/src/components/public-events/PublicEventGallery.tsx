"use client"

import {
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
  X,
} from "lucide-react"

import type {
  FormEvent,
} from "react"

import type {
  LucideIcon,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"


type PublicEventResponse = {
  workspace: {
    name: string
    slug: string
  }

  event: {
    id: string

    title: string
    slug: string

    description: string | null

    event_date: string | null
    location: string | null

    status: string
    photo_count: number

    discovery: {
      browse: boolean
      bib_search: boolean
      face_search: boolean
    }

    pricing: {
      currency: string

      price_per_photo_cents: number
      price_per_photo_rm: number

      bundle_enabled: boolean
      bundle_quantity: number
      bundle_price_cents: number
      bundle_price_rm: number
    }

    sales: {
      open: boolean
      ends_at: string | null
    }
  }
}


type PublicPhoto = {
  id: string

  width: number | null
  height: number | null

  preview_url: string
  preview_url_expires_in: number
}


type PublicPhotosResponse = {
  event_id: string

  total: number

  limit: number
  offset: number

  returned: number
  has_more: boolean

  photos: PublicPhoto[]
}


type BibSearchResponse = {
  event_id: string

  query: string
  bib_number: string

  total: number
  returned: number
  truncated: boolean

  photos: PublicPhoto[]
}


const API_URL = (
  process.env.NEXT_PUBLIC_API_URL
  || "http://localhost:8000"
).replace(
  /\/+$/,
  ""
)


export default function PublicEventGallery({
  workspaceSlug,
  eventSlug,
}: {
  workspaceSlug: string
  eventSlug: string
}) {
  const [
    eventData,
    setEventData,
  ] = useState<PublicEventResponse | null>(
    null
  )

  const [
    photos,
    setPhotos,
  ] = useState<PublicPhoto[]>(
    []
  )

  const [
    loading,
    setLoading,
  ] = useState(
    true
  )

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(
    false
  )

  const [
    errorMessage,
    setErrorMessage,
  ] = useState(
    ""
  )

  const [
    hasMore,
    setHasMore,
  ] = useState(
    false
  )


  // ----------------------------------
  // BIB SEARCH
  // ----------------------------------

  const [
    bibSearchOpen,
    setBibSearchOpen,
  ] = useState(
    false
  )

  const [
    bibInput,
    setBibInput,
  ] = useState(
    ""
  )

  const [
    bibSearching,
    setBibSearching,
  ] = useState(
    false
  )

  const [
    bibSearchDone,
    setBibSearchDone,
  ] = useState(
    false
  )

  const [
    bibSearchError,
    setBibSearchError,
  ] = useState(
    ""
  )

  const [
    searchedBib,
    setSearchedBib,
  ] = useState(
    ""
  )

  const [
    bibResults,
    setBibResults,
  ] = useState<PublicPhoto[]>(
    []
  )


  // ----------------------------------
  // LIGHTBOX
  // ----------------------------------

  const [
    lightboxPhotos,
    setLightboxPhotos,
  ] = useState<PublicPhoto[]>(
    []
  )

  const [
    lightboxIndex,
    setLightboxIndex,
  ] = useState<number | null>(
    null
  )


  useEffect(() => {
    async function loadEvent() {
      setLoading(
        true
      )

      setErrorMessage(
        ""
      )


      try {
        const eventResponse =
          await fetch(
            `${API_URL}/api/public/events/${encodeURIComponent(
              workspaceSlug
            )}/${encodeURIComponent(
              eventSlug
            )}`,
            {
              cache: "no-store",
            }
          )


        if (
          !eventResponse.ok
        ) {
          if (
            eventResponse.status
            === 404
          ) {
            throw new Error(
              "This event is not available."
            )
          }

          throw new Error(
            "Unable to load this event."
          )
        }


        const eventResult =
          (
            await eventResponse.json()
          ) as PublicEventResponse


        setEventData(
          eventResult
        )


        if (
          !eventResult
            .event
            .discovery
            .browse
        ) {
          setPhotos(
            []
          )

          setHasMore(
            false
          )

          return
        }


        const photoResponse =
          await fetch(
            `${API_URL}/api/public/events/${encodeURIComponent(
              workspaceSlug
            )}/${encodeURIComponent(
              eventSlug
            )}/photos?limit=24&offset=0`,
            {
              cache: "no-store",
            }
          )


        if (
          !photoResponse.ok
        ) {
          throw new Error(
            "Unable to load event photos."
          )
        }


        const photoResult =
          (
            await photoResponse.json()
          ) as PublicPhotosResponse


        setPhotos(
          photoResult.photos
        )

        setHasMore(
          photoResult.has_more
        )

      } catch (
        error
      ) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load event."
        )

      } finally {
        setLoading(
          false
        )
      }
    }


    loadEvent()

  }, [
    workspaceSlug,
    eventSlug,
  ])


  async function loadMore() {
    if (
      loadingMore
      || !hasMore
    ) {
      return
    }


    setLoadingMore(
      true
    )


    try {
      const response =
        await fetch(
          `${API_URL}/api/public/events/${encodeURIComponent(
            workspaceSlug
          )}/${encodeURIComponent(
            eventSlug
          )}/photos?limit=24&offset=${photos.length}`,
          {
            cache: "no-store",
          }
        )


      if (
        !response.ok
      ) {
        throw new Error(
          "Unable to load more photos."
        )
      }


      const result =
        (
          await response.json()
        ) as PublicPhotosResponse


      setPhotos(
        (
          current
        ) => [
          ...current,
          ...result.photos,
        ]
      )


      setHasMore(
        result.has_more
      )

    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load more photos."
      )

    } finally {
      setLoadingMore(
        false
      )
    }
  }


  // ----------------------------------
  // BIB SEARCH
  // ----------------------------------


  async function searchBib(
    submitEvent: FormEvent<HTMLFormElement>
  ) {
    submitEvent.preventDefault()


    const value =
      bibInput.trim()


    if (!value) {
      setBibSearchError(
        "Enter your bib number."
      )

      return
    }


    setBibSearching(
      true
    )

    setBibSearchError(
      ""
    )

    setBibSearchDone(
      false
    )


    try {
      const response =
        await fetch(
          `${API_URL}/api/public/events/${encodeURIComponent(
            workspaceSlug
          )}/${encodeURIComponent(
            eventSlug
          )}/bib-search?bib=${encodeURIComponent(
            value
          )}`,
          {
            cache: "no-store",
          }
        )


      const payload =
        (
          await response.json()
        ) as (
          BibSearchResponse
          | {
              detail?: string
            }
        )


      if (
        !response.ok
      ) {
        throw new Error(
          "detail" in payload
            && payload.detail
            ? payload.detail
            : "Unable to search this bib number."
        )
      }


      const result =
        payload as BibSearchResponse


      setSearchedBib(
        result.bib_number
      )

      setBibResults(
        result.photos
      )

      setBibSearchDone(
        true
      )

    } catch (
      error
    ) {
      setBibResults(
        []
      )

      setBibSearchError(
        error instanceof Error
          ? error.message
          : "Unable to search this bib number."
      )

    } finally {
      setBibSearching(
        false
      )
    }
  }


  function clearBibSearch() {
    setBibInput(
      ""
    )

    setSearchedBib(
      ""
    )

    setBibResults(
      []
    )

    setBibSearchDone(
      false
    )

    setBibSearchError(
      ""
    )
  }


  function openBibSearch() {
    setBibSearchOpen(
      true
    )

    window.setTimeout(
      () => {
        document
          .getElementById(
            "bib-search-panel"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          })
      },
      50
    )
  }


  function scrollToGallery() {
    document
      .getElementById(
        "event-photos"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
  }


  // ----------------------------------
  // LIGHTBOX
  // ----------------------------------


  function openLightbox(
    sourcePhotos: PublicPhoto[],
    index: number
  ) {
    setLightboxPhotos(
      sourcePhotos
    )

    setLightboxIndex(
      index
    )
  }


  function closePreview() {
    setLightboxIndex(
      null
    )

    setLightboxPhotos(
      []
    )
  }


  function showPrevious() {
    if (
      lightboxIndex === null
      || lightboxPhotos.length === 0
    ) {
      return
    }


    setLightboxIndex(
      lightboxIndex === 0
        ? lightboxPhotos.length - 1
        : lightboxIndex - 1
    )
  }


  function showNext() {
    if (
      lightboxIndex === null
      || lightboxPhotos.length === 0
    ) {
      return
    }


    setLightboxIndex(
      lightboxIndex
      === lightboxPhotos.length - 1
        ? 0
        : lightboxIndex + 1
    )
  }


  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB]">

        <div className="flex items-center gap-3 text-sm font-semibold text-[#56717A]">

          <Loader2 className="h-5 w-5 animate-spin text-[#0BA5B4]" />

          Loading event gallery...

        </div>

      </main>
    )
  }


  if (
    errorMessage
    || !eventData
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] px-5">

        <div className="w-full max-w-md rounded-[28px] border border-[#DFE9EC] bg-white p-8 text-center shadow-sm">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF8F9]">

            <Camera className="h-6 w-6 text-[#149BA7]" />

          </div>


          <h1 className="mt-5 text-xl font-semibold text-[#173B46]">
            Event unavailable
          </h1>


          <p className="mt-2 text-sm leading-6 text-[#73868D]">
            {errorMessage}
          </p>

        </div>

      </main>
    )
  }


  const {
    workspace,
    event,
  } = eventData


  const selectedPhoto =
    lightboxIndex === null
      ? null
      : lightboxPhotos[
          lightboxIndex
        ]


  return (
    <main className="min-h-screen bg-[#F7FAFB] text-[#153842]">

      {/* NAVBAR */}

      <header className="sticky top-0 z-40 border-b border-[#E2EBED] bg-white/95 backdrop-blur">

        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-5 sm:px-7 lg:px-10">

          <div className="min-w-0">

            <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[#163A44]">
              {workspace.name}
            </p>

            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#0B9AA7]">
              Event Photography
            </p>

          </div>


          <div className="flex items-center gap-2 rounded-full border border-[#DDE8EB] bg-[#F9FBFB] px-3 py-1.5">

            <ShieldCheck className="h-3.5 w-3.5 text-[#159B83]" />

            <span className="text-[11px] font-semibold text-[#60777F]">
              Protected previews
            </span>

          </div>

        </div>

      </header>


      {/* HERO */}

      <section className="border-b border-[#E1EAED] bg-white">

        <div className="mx-auto max-w-[1500px] px-5 py-10 sm:px-7 lg:px-10 lg:py-14">

          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#0B9AA7]">
                Event Gallery
              </p>


              <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] text-[#112F39] sm:text-[44px] lg:text-[52px]">
                {event.title}
              </h1>


              {event.description && (
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#687E86] sm:text-[15px]">
                  {event.description}
                </p>
              )}


              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#698089]">

                {event.event_date && (
                  <div className="flex items-center gap-2">

                    <CalendarDays className="h-4 w-4 text-[#178E9A]" />

                    {formatDate(
                      event.event_date
                    )}

                  </div>
                )}


                {event.location && (
                  <div className="flex items-center gap-2">

                    <MapPin className="h-4 w-4 text-[#178E9A]" />

                    {event.location}

                  </div>
                )}


                <div className="flex items-center gap-2">

                  <ImageIcon className="h-4 w-4 text-[#178E9A]" />

                  {event.photo_count}
                  {" "}
                  photos

                </div>

              </div>

            </div>


            <div className="rounded-[22px] border border-[#DFE9EB] bg-[#FAFCFC] px-5 py-4 lg:min-w-[220px]">

              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8A9BA1]">
                From
              </p>


              <div className="mt-1 flex items-baseline gap-1">

                <span className="text-2xl font-semibold tracking-[-0.03em] text-[#123A45]">

                  RM
                  {" "}
                  {event
                    .pricing
                    .price_per_photo_rm
                    .toFixed(
                      2
                    )}

                </span>


                <span className="text-xs text-[#81949A]">
                  / photo
                </span>

              </div>


              {event
                .pricing
                .bundle_enabled && (

                <p className="mt-2 text-xs leading-5 text-[#6C828A]">

                  {event
                    .pricing
                    .bundle_quantity}
                  {" "}
                  photos for RM
                  {event
                    .pricing
                    .bundle_price_rm
                    .toFixed(
                      2
                    )}

                </p>

              )}

            </div>

          </div>

        </div>

      </section>


      {/* FIND YOUR PHOTOS */}

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-7 lg:px-10">

        <div className="rounded-[28px] border border-[#DDE8EB] bg-white p-5 shadow-[0_12px_35px_rgba(24,62,72,0.04)] sm:p-6 lg:p-7">

          <div>

            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0B9AA7]">
              Find your photos
            </p>


            <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#163B46] sm:text-2xl">
              Skip the scrolling.
            </h2>


            <p className="mt-2 text-sm leading-6 text-[#70848B]">
              Use your race bib or a selfie to find matching event photos.
            </p>

          </div>


          <div className="mt-6 grid gap-3 md:grid-cols-3">

            {event
              .discovery
              .bib_search && (

              <DiscoveryCard
                icon={
                  Search
                }
                title="Search by bib"
                description="Enter your race number and find matching photos."
                label="Bib search"
                onClick={
                  openBibSearch
                }
                active={
                  bibSearchOpen
                }
              />

            )}


            {event
              .discovery
              .face_search && (

              <DiscoveryCard
                icon={
                  UserRoundSearch
                }
                title="Find me with selfie"
                description="Upload a selfie and let AI find possible matches."
                label="Coming next"
                disabled
              />

            )}


            {event
              .discovery
              .browse && (

              <DiscoveryCard
                icon={
                  ImageIcon
                }
                title="Browse gallery"
                description={
                  `Explore all ${event.photo_count} available event photos.`
                }
                label="Browse below"
                onClick={
                  scrollToGallery
                }
              />

            )}

          </div>


          {/* BIB SEARCH PANEL */}

          {bibSearchOpen && (

            <div
              id="bib-search-panel"
              className="mt-6 overflow-hidden rounded-[22px] border border-[#D9E7E9] bg-[#F8FBFB]"
            >

              <div className="border-b border-[#DFE9EB] px-5 py-5 sm:px-6">

                <div className="flex items-start justify-between gap-4">

                  <div>

                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0B9AA7]">
                      Bib Search
                    </p>


                    <h3 className="mt-1.5 text-lg font-semibold text-[#214650]">
                      Enter your race number
                    </h3>


                    <p className="mt-1 text-sm text-[#788C93]">
                      We&apos;ll look for photos where your bib was recognized.
                    </p>

                  </div>


                  <button
                    type="button"
                    onClick={() =>
                      setBibSearchOpen(
                        false
                      )
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D9E5E8] bg-white text-[#6D8289] transition hover:bg-[#F2F7F8]"
                  >

                    <X className="h-4 w-4" />

                  </button>

                </div>


                <form
                  onSubmit={
                    searchBib
                  }
                  className="mt-5 flex flex-col gap-3 sm:flex-row"
                >

                  <div className="relative flex-1">

                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78939A]" />

                    <input
                      type="text"
                      value={
                        bibInput
                      }
                      onChange={(
                        inputEvent
                      ) => {
                        setBibInput(
                          inputEvent.target.value
                        )

                        setBibSearchError(
                          ""
                        )
                      }}
                      placeholder="e.g. M90006"
                      autoComplete="off"
                      className="h-12 w-full rounded-xl border border-[#D5E3E6] bg-white pl-11 pr-4 text-sm font-semibold uppercase text-[#244A54] outline-none transition placeholder:font-normal placeholder:normal-case placeholder:text-[#9AA9AE] focus:border-[#49BAC4] focus:ring-4 focus:ring-[#DFF6F7]"
                    />

                  </div>


                  <button
                    type="submit"
                    disabled={
                      bibSearching
                    }
                    className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-6 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {bibSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}

                    Search photos

                  </button>


                  {bibSearchDone && (

                    <button
                      type="button"
                      onClick={
                        clearBibSearch
                      }
                      className="h-12 rounded-xl border border-[#D8E4E7] bg-white px-5 text-sm font-semibold text-[#607880] transition hover:bg-[#F5F9FA]"
                    >
                      Clear
                    </button>

                  )}

                </form>


                {bibSearchError && (

                  <div className="mt-3 rounded-xl border border-[#F1CED2] bg-[#FFF7F7] px-4 py-3 text-sm font-medium text-[#A64F58]">
                    {bibSearchError}
                  </div>

                )}

              </div>


              {bibSearchDone && (

                <div className="p-5 sm:p-6">

                  <div className="flex flex-wrap items-end justify-between gap-3">

                    <div>

                      <p className="text-sm font-semibold text-[#315963]">

                        Results for
                        {" "}
                        <span className="text-[#0B8D99]">
                          {searchedBib}
                        </span>

                      </p>


                      <p className="mt-1 text-xs text-[#82949A]">

                        {bibResults.length === 1
                          ? "1 matching photo found."
                          : `${bibResults.length} matching photos found.`}

                      </p>

                    </div>

                  </div>


                  {bibResults.length === 0 ? (

                    <div className="mt-5 rounded-[18px] border border-dashed border-[#D3E2E5] bg-white px-5 py-10 text-center">

                      <Search className="mx-auto h-6 w-6 text-[#91AAB0]" />


                      <p className="mt-3 font-semibold text-[#44636B]">
                        No matching photos found
                      </p>


                      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#87989E]">
                        Check the bib number and try again. You can also browse the gallery or use selfie search when available.
                      </p>

                    </div>

                  ) : (

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                      {bibResults.map(
                        (
                          photo,
                          index
                        ) => (

                          <PhotoButton
                            key={
                              photo.id
                            }
                            photo={
                              photo
                            }
                            index={
                              index
                            }
                            onClick={() =>
                              openLightbox(
                                bibResults,
                                index
                              )
                            }
                          />

                        )
                      )}

                    </div>

                  )}

                </div>

              )}

            </div>

          )}

        </div>

      </section>


      {/* BROWSE GALLERY */}

      {event
        .discovery
        .browse && (

        <section
          id="event-photos"
          className="mx-auto max-w-[1500px] scroll-mt-24 px-5 pb-16 sm:px-7 lg:px-10"
        >

          <div className="mb-5 flex items-end justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#0B9AA7]">
                Event Photos
              </p>


              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#153A44]">
                Browse all photos
              </h2>

            </div>


            <p className="hidden text-sm text-[#809298] sm:block">

              {photos.length}
              {" "}
              of
              {" "}
              {event.photo_count}

            </p>

          </div>


          {photos.length === 0 ? (

            <div className="rounded-[28px] border border-dashed border-[#D5E3E6] bg-white px-6 py-16 text-center">

              <Camera className="mx-auto h-7 w-7 text-[#8EB1B8]" />

              <p className="mt-4 font-semibold text-[#375A64]">
                No photos available yet
              </p>

            </div>

          ) : (

            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">

              {photos.map(
                (
                  photo,
                  index
                ) => (

                  <PhotoButton
                    key={
                      photo.id
                    }
                    photo={
                      photo
                    }
                    index={
                      index
                    }
                    masonry
                    onClick={() =>
                      openLightbox(
                        photos,
                        index
                      )
                    }
                  />

                )
              )}

            </div>

          )}


          {hasMore && (

            <div className="mt-8 flex justify-center">

              <button
                type="button"
                disabled={
                  loadingMore
                }
                onClick={
                  loadMore
                }
                className="flex h-11 items-center gap-2 rounded-xl border border-[#D8E4E7] bg-white px-5 text-sm font-semibold text-[#375E68] transition hover:bg-[#F7FAFB] disabled:opacity-50"
              >

                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}

                Load more photos

              </button>

            </div>

          )}

        </section>

      )}


      {/* FOOTER */}

      <footer className="border-t border-[#DFE8EA] bg-white">

        <div className="mx-auto flex max-w-[1500px] flex-col gap-2 px-5 py-7 sm:px-7 lg:px-10">

          <p className="text-sm font-semibold text-[#365861]">
            {workspace.name}
          </p>


          <p className="text-xs text-[#8A9CA1]">
            Event gallery powered by EZFOTOO
          </p>

        </div>

      </footer>


      {/* LIGHTBOX */}

      {selectedPhoto && (

        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061A21]/92 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(
            clickEvent
          ) => {
            if (
              clickEvent.target
              === clickEvent.currentTarget
            ) {
              closePreview()
            }
          }}
        >

          <div className="relative flex h-full max-h-[94vh] w-full max-w-[1450px] items-center justify-center">


            <button
              type="button"
              onClick={
                closePreview
              }
              className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-[#0A2B35]/85 text-white/80 backdrop-blur transition hover:bg-[#103945] hover:text-white"
            >

              <X className="h-5 w-5" />

            </button>


            {lightboxPhotos.length > 1 && (

              <>
                <button
                  type="button"
                  onClick={
                    showPrevious
                  }
                  className="absolute left-2 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-[#0A2B35]/85 text-white/80 backdrop-blur transition hover:bg-[#103945] hover:text-white"
                >

                  <ChevronLeft className="h-5 w-5" />

                </button>


                <button
                  type="button"
                  onClick={
                    showNext
                  }
                  className="absolute right-2 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-[#0A2B35]/85 text-white/80 backdrop-blur transition hover:bg-[#103945] hover:text-white"
                >

                  <ChevronRight className="h-5 w-5" />

                </button>
              </>

            )}


            <img
              src={
                selectedPhoto.preview_url
              }
              alt="Protected event preview"
              className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            />


            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#061A21]/80 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur">

              Protected preview
              {" "}
              •
              {" "}
              {lightboxIndex !== null
                ? lightboxIndex + 1
                : 0}
              {" "}
              /
              {" "}
              {lightboxPhotos.length}

            </div>

          </div>

        </div>

      )}

    </main>
  )
}


function PhotoButton({
  photo,
  index,
  masonry = false,
  onClick,
}: {
  photo: PublicPhoto
  index: number
  masonry?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={
        [
          "group relative block w-full overflow-hidden rounded-[18px] bg-[#EAF1F3] text-left",
          masonry
            ? "mb-4 break-inside-avoid"
            : "",
        ]
          .filter(
            Boolean
          )
          .join(
            " "
          )
      }
    >

      <img
        src={
          photo.preview_url
        }
        alt={
          `Protected event photo ${index + 1}`
        }
        loading="lazy"
        className={
          masonry
            ? "h-auto w-full transition duration-500 group-hover:scale-[1.015]"
            : "aspect-[3/2] w-full object-cover transition duration-500 group-hover:scale-[1.015]"
        }
      />


      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071B22]/35 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />


      <div className="pointer-events-none absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-[#155866] opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100">

        <Sparkles className="h-4 w-4" />

      </div>

    </button>
  )
}


function DiscoveryCard({
  icon: Icon,
  title,
  description,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: LucideIcon

  title: string
  description: string
  label: string

  onClick?: () => void

  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      className={
        [
          "group w-full rounded-[20px] border p-5 text-left transition",
          active
            ? "border-[#8BD5DB] bg-[#F0FBFB] shadow-[0_8px_24px_rgba(27,122,137,0.08)]"
            : "border-[#E0E9EB] bg-[#FBFCFC]",
          disabled
            ? "cursor-default opacity-60"
            : "hover:border-[#B9DDE1] hover:bg-[#F7FBFB]",
        ]
          .join(
            " "
          )
      }
    >

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F8F9]">

        <Icon className="h-[18px] w-[18px] text-[#0B9BA8]" />

      </div>


      <h3 className="mt-4 font-semibold text-[#244A54]">
        {title}
      </h3>


      <p className="mt-1.5 min-h-10 text-xs leading-5 text-[#7B8E95]">
        {description}
      </p>


      <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#18838E]">

        {label}

        {!disabled && (
          <ChevronRight className="h-3.5 w-3.5" />
        )}

      </div>

    </button>
  )
}


function formatDate(
  value: string
) {
  const date = new Date(
    `${value}T00:00:00`
  )


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }


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