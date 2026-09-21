"use client"

import {
  Camera,
  CameraOff,
  Check,
  ImagePlus,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  SwitchCamera,
  Upload,
  X,
} from "lucide-react"

import {
  useEffect,
  useRef,
  useState,
} from "react"


export type SelfieSearchPhoto = {
  id: string
  width: number | null
  height: number | null

  preview_url: string
  preview_url_expires_in: number

  similarity?: number
}


type SelfieSearchResponse = {
  event_id: string

  total: number
  threshold: number

  photos: SelfieSearchPhoto[]

  privacy: {
    selfie_stored: boolean
    message: string
  }
}


type CameraFacingMode =
  | "user"
  | "environment"


const API_URL = (
  process.env.NEXT_PUBLIC_API_URL
  || "http://localhost:8000"
).replace(
  /\/+$/,
  ""
)


const MAX_SELFIE_BYTES =
  10
  * 1024
  * 1024


const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])


export default function SelfieSearchPanel({
  workspaceSlug,
  eventSlug,
  onResults,
}: {
  workspaceSlug: string
  eventSlug: string

  onResults: (
    photos: SelfieSearchPhoto[]
  ) => void
}) {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    )

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    )

  const streamRef =
    useRef<MediaStream | null>(
      null
    )


  const [
    cameraOpen,
    setCameraOpen,
  ] = useState(
    false
  )

  const [
    cameraStarting,
    setCameraStarting,
  ] = useState(
    false
  )

  const [
    facingMode,
    setFacingMode,
  ] = useState<CameraFacingMode>(
    "user"
  )

  const [
    selectedImage,
    setSelectedImage,
  ] = useState<Blob | null>(
    null
  )

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState(
    ""
  )

  const [
    searching,
    setSearching,
  ] = useState(
    false
  )

  const [
    searchDone,
    setSearchDone,
  ] = useState(
    false
  )

  const [
    resultCount,
    setResultCount,
  ] = useState(
    0
  )

  const [
    errorMessage,
    setErrorMessage,
  ] = useState(
    ""
  )


  // ----------------------------------
  // CLEANUP
  // ----------------------------------


  function stopCamera() {
    const stream =
      streamRef.current


    if (stream) {
      stream
        .getTracks()
        .forEach(
          (
            track
          ) => {
            track.stop()
          }
        )
    }


    streamRef.current =
      null


    if (
      videoRef.current
    ) {
      videoRef.current.srcObject =
        null
    }


    setCameraOpen(
      false
    )
  }


  function clearPreviewUrl() {
    if (
      previewUrl
    ) {
      URL.revokeObjectURL(
        previewUrl
      )
    }
  }


  useEffect(() => {
    return () => {
      const stream =
        streamRef.current


      if (stream) {
        stream
          .getTracks()
          .forEach(
            (
              track
            ) => {
              track.stop()
            }
          )
      }
    }
  }, [])


  // ----------------------------------
  // CAMERA
  // ----------------------------------


  async function startCamera(
    mode: CameraFacingMode =
      facingMode
  ) {
    setCameraStarting(
      true
    )

    setErrorMessage(
      ""
    )


    try {
      if (
        !navigator.mediaDevices
        ?.getUserMedia
      ) {
        throw new Error(
          "Camera access is not supported by this browser."
        )
      }


      stopCamera()


      const stream =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: false,

            video: {
              facingMode: {
                ideal:
                  mode,
              },

              width: {
                ideal:
                  1280,
              },

              height: {
                ideal:
                  1280,
              },
            },
          })


      streamRef.current =
        stream


      setFacingMode(
        mode
      )

      setCameraOpen(
        true
      )


      window.setTimeout(
        async () => {
          if (
            videoRef.current
          ) {
            videoRef.current.srcObject =
              stream

            try {
              await videoRef
                .current
                .play()

            } catch {
              // Browser may begin automatically.
            }
          }
        },
        0
      )

    } catch (
      error
    ) {
      setCameraOpen(
        false
      )

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to access the camera."
      )

    } finally {
      setCameraStarting(
        false
      )
    }
  }


  async function switchCamera() {
    const nextMode:
      CameraFacingMode =
      facingMode === "user"
        ? "environment"
        : "user"


    await startCamera(
      nextMode
    )
  }


  function capturePhoto() {
    const video =
      videoRef.current


    if (
      !video
      || video.videoWidth <= 0
      || video.videoHeight <= 0
    ) {
      setErrorMessage(
        "The camera is not ready yet."
      )

      return
    }


    const canvas =
      document.createElement(
        "canvas"
      )


    canvas.width =
      video.videoWidth

    canvas.height =
      video.videoHeight


    const context =
      canvas.getContext(
        "2d"
      )


    if (!context) {
      setErrorMessage(
        "Unable to capture the selfie."
      )

      return
    }


    // Capture the real camera frame.
    //
    // The live front-camera preview is mirrored
    // visually with CSS, but the stored search
    // image itself remains unmirrored.
    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    )


    canvas.toBlob(
      (
        blob
      ) => {
        if (!blob) {
          setErrorMessage(
            "Unable to capture the selfie."
          )

          return
        }


        setSelectedSelfie(
          blob
        )

        stopCamera()
      },
      "image/jpeg",
      0.92
    )
  }


  // ----------------------------------
  // IMAGE SELECTION
  // ----------------------------------


  function setSelectedSelfie(
    image: Blob
  ) {
    clearPreviewUrl()


    const url =
      URL.createObjectURL(
        image
      )


    setSelectedImage(
      image
    )

    setPreviewUrl(
      url
    )

    setSearchDone(
      false
    )

    setResultCount(
      0
    )

    setErrorMessage(
      ""
    )

    onResults(
      []
    )
  }


  function handleFile(
    file: File | null
  ) {
    if (!file) {
      return
    }


    if (
      !ALLOWED_TYPES.has(
        file.type
      )
    ) {
      setErrorMessage(
        "Please choose a JPEG, PNG, or WebP image."
      )

      return
    }


    if (
      file.size
      > MAX_SELFIE_BYTES
    ) {
      setErrorMessage(
        "The selfie must be 10 MB or smaller."
      )

      return
    }


    setSelectedSelfie(
      file
    )
  }


  function resetSelfie() {
    stopCamera()

    clearPreviewUrl()


    setSelectedImage(
      null
    )

    setPreviewUrl(
      ""
    )

    setSearchDone(
      false
    )

    setResultCount(
      0
    )

    setErrorMessage(
      ""
    )

    onResults(
      []
    )


    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        ""
    }
  }


  // ----------------------------------
  // SEARCH
  // ----------------------------------


  async function findPhotos() {
    if (
      !selectedImage
    ) {
      setErrorMessage(
        "Take a selfie or upload a photo first."
      )

      return
    }


    setSearching(
      true
    )

    setSearchDone(
      false
    )

    setResultCount(
      0
    )

    setErrorMessage(
      ""
    )

    onResults(
      []
    )


    try {
      const contentType =
        selectedImage.type
        || "image/jpeg"


      const response =
        await fetch(
          `${API_URL}/api/public/events/${encodeURIComponent(
            workspaceSlug
          )}/${encodeURIComponent(
            eventSlug
          )}/selfie-search`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                contentType,
            },

            body:
              selectedImage,
          }
        )


      const payload =
        (
          await response.json()
        ) as (
          SelfieSearchResponse
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
            : "Unable to complete selfie search."
        )
      }


      const result =
        payload as SelfieSearchResponse


      setResultCount(
        result.total
      )

      setSearchDone(
        true
      )

      onResults(
        result.photos
      )

    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete selfie search."
      )

    } finally {
      setSearching(
        false
      )
    }
  }


  return (
    <div className="overflow-hidden rounded-[22px] border border-[#D9E7E9] bg-[#F8FBFB]">

      {/* HEADER */}

      <div className="border-b border-[#DFE9EB] px-5 py-5 sm:px-6">

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">

          <div>

            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0B9AA7]">
              Selfie Search
            </p>


            <h3 className="mt-1.5 text-lg font-semibold text-[#214650]">
              Find yourself in the event
            </h3>


            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#788C93]">
              Take a clear selfie or upload a recent photo. We&apos;ll compare your face with indexed event photos.
            </p>

          </div>


          <div className="flex items-center gap-2 rounded-xl border border-[#D8E7E9] bg-white px-3 py-2">

            <ShieldCheck className="h-4 w-4 text-[#159B83]" />

            <span className="text-[11px] font-semibold text-[#627A82]">
              Selfie not stored
            </span>

          </div>

        </div>

      </div>


      <div className="p-5 sm:p-6">

        {/* NO SELFIE YET */}

        {!selectedImage && (
          <div className="grid gap-4 lg:grid-cols-2">

            {/* CAMERA */}

            <div className="rounded-[20px] border border-[#DCE8EA] bg-white p-5">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F8F9]">

                <Camera className="h-5 w-5 text-[#0B98A5]" />

              </div>


              <h4 className="mt-4 font-semibold text-[#284D57]">
                Take a selfie
              </h4>


              <p className="mt-1 text-xs leading-5 text-[#809198]">
                Use your phone&apos;s front camera or your laptop webcam.
              </p>


              <button
                type="button"
                disabled={
                  cameraStarting
                }
                onClick={() =>
                  startCamera(
                    "user"
                  )
                }
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-4 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:opacity-60"
              >

                {cameraStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}

                Open camera

              </button>

            </div>


            {/* UPLOAD */}

            <div className="rounded-[20px] border border-[#DCE8EA] bg-white p-5">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F8F9]">

                <ImagePlus className="h-5 w-5 text-[#0B98A5]" />

              </div>


              <h4 className="mt-4 font-semibold text-[#284D57]">
                Upload a photo
              </h4>


              <p className="mt-1 text-xs leading-5 text-[#809198]">
                Choose a clear photo from your phone or computer.
              </p>


              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                className="hidden"
                onChange={(
                  event
                ) =>
                  handleFile(
                    event.target
                      .files?.[0]
                    ?? null
                  )
                }
              />


              <button
                type="button"
                onClick={() =>
                  fileInputRef.current
                    ?.click()
                }
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#CFE0E3] bg-white px-4 text-sm font-semibold text-[#315B65] transition hover:bg-[#F5FAFA]"
              >

                <Upload className="h-4 w-4" />

                Choose photo

              </button>

            </div>

          </div>
        )}


        {/* LIVE CAMERA */}

        {cameraOpen && (
          <div className="mt-5 overflow-hidden rounded-[22px] border border-[#D4E4E7] bg-[#071E26]">

            <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">

              <video
                ref={
                  videoRef
                }
                autoPlay
                playsInline
                muted
                className={
                  [
                    "h-full w-full object-cover",
                    facingMode === "user"
                      ? "-scale-x-100"
                      : "",
                  ].join(
                    " "
                  )
                }
              />


              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

                <div className="h-[62%] w-[48%] max-w-[310px] rounded-[46%] border-2 border-white/55 shadow-[0_0_0_999px_rgba(0,0,0,0.12)]" />

              </div>

            </div>


            <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 p-4">

              <button
                type="button"
                onClick={
                  stopCamera
                }
                className="flex h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >

                <CameraOff className="h-4 w-4" />

                Cancel

              </button>


              <button
                type="button"
                onClick={
                  capturePhoto
                }
                className="flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#123D48] transition hover:bg-[#EAF8F9]"
              >

                <Camera className="h-4 w-4" />

                Take photo

              </button>


              <button
                type="button"
                onClick={
                  switchCamera
                }
                className="flex h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >

                <SwitchCamera className="h-4 w-4" />

                Switch

              </button>

            </div>

          </div>
        )}


        {/* SELECTED SELFIE */}

        {selectedImage && (
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">

            <div className="overflow-hidden rounded-[20px] border border-[#D7E5E8] bg-white">

              <div className="aspect-square overflow-hidden bg-[#EAF1F3]">

                {previewUrl && (
                  <img
                    src={
                      previewUrl
                    }
                    alt="Selected selfie"
                    className="h-full w-full object-cover"
                  />
                )}

              </div>


              <div className="flex items-center gap-2 border-t border-[#E1E9EB] px-4 py-3 text-xs font-semibold text-[#5C767E]">

                <Check className="h-4 w-4 text-[#159B83]" />

                Selfie ready

              </div>

            </div>


            <div className="flex flex-col justify-center">

              <h4 className="text-lg font-semibold text-[#234852]">
                Ready to search?
              </h4>


              <p className="mt-2 max-w-xl text-sm leading-6 text-[#768A91]">
                For the best results, use a clear photo with one visible face looking toward the camera.
              </p>


              <div className="mt-5 flex flex-wrap gap-3">

                <button
                  type="button"
                  disabled={
                    searching
                  }
                  onClick={
                    findPhotos
                  }
                  className="flex h-12 items-center gap-2 rounded-xl bg-[#073B4C] px-6 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:opacity-60"
                >

                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}

                  {searching
                    ? "Finding your photos..."
                    : "Find my photos"}

                </button>


                <button
                  type="button"
                  disabled={
                    searching
                  }
                  onClick={
                    resetSelfie
                  }
                  className="flex h-12 items-center gap-2 rounded-xl border border-[#D5E2E5] bg-white px-5 text-sm font-semibold text-[#5B747C] transition hover:bg-[#F5F9FA]"
                >

                  <RefreshCcw className="h-4 w-4" />

                  Use another photo

                </button>

              </div>


              <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#EAF8F6] px-4 py-3">

                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#168873]" />

                <p className="text-xs leading-5 text-[#50746F]">
                  Your selfie is sent only for this search. EZFOTOO does not save it to your event gallery or permanent storage.
                </p>

              </div>

            </div>

          </div>
        )}


        {/* ERROR */}

        {errorMessage && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-[#F0CDD1] bg-[#FFF7F7] px-4 py-3">

            <p className="text-sm font-medium text-[#A44C56]">
              {errorMessage}
            </p>


            <button
              type="button"
              onClick={() =>
                setErrorMessage(
                  ""
                )
              }
              className="shrink-0 text-[#A44C56]"
            >

              <X className="h-4 w-4" />

            </button>

          </div>
        )}


        {/* RESULT SUMMARY */}

        {searchDone && (
          <div className="mt-5 rounded-[18px] border border-[#D7E6E8] bg-white px-5 py-4">

            <p className="font-semibold text-[#345B65]">

              {resultCount === 0
                ? "No likely matches found"
                : resultCount === 1
                  ? "1 possible match found"
                  : `${resultCount} possible matches found`}

            </p>


            <p className="mt-1 text-xs leading-5 text-[#82949A]">

              {resultCount === 0
                ? "Try another clear selfie, or browse the gallery manually."
                : "Possible matches are shown below. Face search may not always be exact."}

            </p>

          </div>
        )}

      </div>

    </div>
  )
}