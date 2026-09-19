"use client"

import {
  Eye,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react"

import {
  useState,
} from "react"

import { apiFetch } from "@/lib/api"


type PreviewResponse = {
  photo_id: string
  event_id: string

  filename: string

  preview_url: string

  expires_in: number
}


export default function EventPhotoPreviewButton({
  eventId,
  photoId,
  filename,
  enabled,
}: {
  eventId: string
  photoId: string
  filename: string
  enabled: boolean
}) {
  const [
    open,
    setOpen,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState("")

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("")


  async function showPreview() {
    if (!enabled) {
      return
    }

    setLoading(true)
    setErrorMessage("")

    try {
      const result =
        await apiFetch<PreviewResponse>(
          `/api/event-sales/events/${eventId}/photos/${photoId}/preview`
        )

      setPreviewUrl(
        result.preview_url
      )

      setOpen(
        true
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load preview."
      )

      setOpen(
        true
      )

    } finally {
      setLoading(false)
    }
  }


  function closePreview() {
    setOpen(
      false
    )

    setPreviewUrl(
      ""
    )

    setErrorMessage(
      ""
    )
  }


  if (!enabled) {
    return (
      <span className="text-sm font-medium text-[#83959B]">
        Not yet
      </span>
    )
  }


  return (
    <>
      <button
        type="button"
        disabled={
          loading
        }
        onClick={
          showPreview
        }
        className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#267985] transition hover:bg-[#EEF8F9] disabled:opacity-50"
      >

        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}

        View preview

      </button>


      {open && (

        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071D24]/80 p-4 backdrop-blur-sm sm:p-8"
          onMouseDown={(event) => {
            if (
              event.target
              === event.currentTarget
            ) {
              closePreview()
            }
          }}
        >

          <div className="flex max-h-[94vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0A2832] shadow-2xl">

            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">

              <div className="min-w-0">

                <div className="flex items-center gap-2 text-[#67D2DB]">

                  <ShieldCheck className="h-4 w-4" />

                  <p className="text-[11px] font-bold uppercase tracking-[0.13em]">
                    Protected preview
                  </p>

                </div>


                <p className="mt-1 truncate text-sm font-semibold text-white">
                  {filename}
                </p>

              </div>


              <button
                type="button"
                onClick={
                  closePreview
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

            </div>


            <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-auto bg-[#061B22] p-4 sm:p-7">

              {errorMessage ? (

                <div className="max-w-md rounded-2xl border border-[#713F49] bg-[#351F25] px-5 py-4 text-center text-sm text-[#F2BCC5]">
                  {errorMessage}
                </div>

              ) : previewUrl ? (

                <img
                  src={
                    previewUrl
                  }
                  alt={
                    `Protected preview of ${filename}`
                  }
                  className="max-h-[78vh] max-w-full rounded-xl object-contain shadow-2xl"
                />

              ) : (

                <Loader2 className="h-7 w-7 animate-spin text-[#69D4DD]" />

              )}

            </div>


            <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-3.5">

              <p className="text-xs text-white/45">
                Protected customer preview. Original file remains private.
              </p>


              <button
                type="button"
                onClick={
                  closePreview
                }
                className="h-9 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}
    </>
  )
}