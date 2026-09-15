"use client"

import {
  ImagePlus,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react"
import {
  ChangeEvent,
  useRef,
  useState,
} from "react"

import { apiFetch } from "@/lib/api"


type UploadResponse = {
  upload_url: string
  public_url: string
  object_key: string
}


type UploadPurpose =
  | "website-hero"
  | "website-about"
  | "portfolio"
  | "logo"


type Props = {
  label: string
  value?: string
  purpose: UploadPurpose
  aspect?: "wide" | "square" | "portrait"

  onUploaded: (
    publicUrl: string
  ) => void
}


const MAX_FILE_SIZE =
  15 * 1024 * 1024


export default function ImageUploader({
  label,
  value,
  purpose,
  aspect = "wide",
  onUploaded,
}: Props) {
  const inputRef =
    useRef<HTMLInputElement>(null)

  const [uploading, setUploading] =
    useState(false)

  const [error, setError] =
    useState("")


  const aspectClass =
    aspect === "square"
      ? "aspect-square"
      : aspect === "portrait"
        ? "aspect-[4/5]"
        : "aspect-[16/9]"


  async function uploadFile(
    file: File
  ) {
    setError("")

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type)
    ) {
      setError(
        "Only JPG, PNG and WebP images are supported."
      )
      return
    }


    if (file.size > MAX_FILE_SIZE) {
      setError(
        "Image must be smaller than 15 MB."
      )
      return
    }


    setUploading(true)

    try {
      const presigned =
        await apiFetch<UploadResponse>(
          "/api/uploads/presign",
          {
            method: "POST",

            body: JSON.stringify({
              filename: file.name,
              content_type: file.type,
              purpose,
            }),
          }
        )


      const response = await fetch(
        presigned.upload_url,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              file.type,
          },

          body: file,
        }
      )


      if (!response.ok) {
        throw new Error(
          `Upload failed (${response.status}).`
        )
      }


      onUploaded(
        presigned.public_url
      )

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload image."
      )

    } finally {
      setUploading(false)

      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }


  async function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    await uploadFile(file)
  }


  return (
    <div>

      <label className="mb-2 block text-sm font-semibold text-[#36535C]">
        {label}
      </label>


      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />


      {value ? (
        <div className="overflow-hidden rounded-2xl border border-[#DCE6E8] bg-[#F7FAFB]">

          <div
            className={`relative ${aspectClass}`}
          >

            <img
              src={value}
              alt=""
              className="h-full w-full object-cover"
            />


            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">

                <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#36545D]">

                  <Loader2 className="h-4 w-4 animate-spin text-[#0BA3B1]" />

                  Uploading...

                </div>

              </div>
            )}


            {!uploading && (
              <button
                type="button"
                onClick={() =>
                  onUploaded("")
                }
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            )}

          </div>


          <div className="flex items-center justify-between gap-3 px-4 py-3">

            <p className="truncate text-xs text-[#84969D]">
              Image uploaded
            </p>

            <button
              type="button"
              disabled={uploading}
              onClick={() =>
                inputRef.current?.click()
              }
              className="flex items-center gap-2 text-xs font-semibold text-[#087F8C] disabled:opacity-50"
            >
              <UploadCloud className="h-4 w-4" />

              Replace
            </button>

          </div>

        </div>

      ) : (

        <button
          type="button"
          disabled={uploading}
          onClick={() =>
            inputRef.current?.click()
          }
          className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBDCDF] bg-[#FAFCFC] px-6 text-center transition hover:border-[#2CC3D0] hover:bg-[#F4FBFC] disabled:cursor-wait"
        >

          {uploading ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-[#0BA3B1]" />

              <p className="mt-4 text-sm font-semibold text-[#506B73]">
                Uploading image...
              </p>

              <p className="mt-1 text-xs text-[#8A9BA1]">
                Please keep this page open.
              </p>
            </>

          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF8F9]">

                <ImagePlus className="h-5 w-5 text-[#0A99A7]" />

              </div>

              <p className="mt-4 text-sm font-semibold text-[#506B73]">
                Upload photo
              </p>

              <p className="mt-1 text-xs text-[#8A9BA1]">
                JPG, PNG or WebP · Max 15 MB
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#073B4C] px-4 py-2 text-xs font-semibold text-white">

                <UploadCloud className="h-4 w-4" />

                Browse files

              </div>
            </>
          )}

        </button>

      )}


      {error && (
        <p className="mt-2 text-xs font-medium text-[#B34F59]">
          {error}
        </p>
      )}

    </div>
  )
}