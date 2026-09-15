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


export type UploadedMedia = {
  id: string
  object_key: string
  public_url: string
  filename: string
  content_type: string
  size_bytes: number
  purpose: string
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

  aspect?:
    | "wide"
    | "square"
    | "portrait"

  onUploaded: (
    asset: UploadedMedia
  ) => void

  onRemove?: () => void
}


const MAX_FILE_SIZE =
  15 * 1024 * 1024


export default function ImageUploader({
  label,
  value,
  purpose,
  aspect = "wide",
  onUploaded,
  onRemove,
}: Props) {
  const inputRef =
    useRef<HTMLInputElement>(
      null
    )

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


    if (
      file.size >
      MAX_FILE_SIZE
    ) {
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
              filename:
                file.name,

              content_type:
                file.type,

              purpose,

              file_size:
                file.size,
            }),
          }
        )


      const uploadResponse =
        await fetch(
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


      if (
        !uploadResponse.ok
      ) {
        throw new Error(
          `Upload failed (${uploadResponse.status}).`
        )
      }


      const asset =
        await apiFetch<UploadedMedia>(
          "/api/uploads/complete",
          {
            method: "POST",

            body: JSON.stringify({
              object_key:
                presigned.object_key,

              filename:
                file.name,

              content_type:
                file.type,

              purpose,
            }),
          }
        )


      onUploaded(
        asset
      )

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload image."
      )

    } finally {
      setUploading(false)

      if (
        inputRef.current
      ) {
        inputRef.current.value =
          ""
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

    await uploadFile(
      file
    )
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
        onChange={
          handleFile
        }
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
              <div className="absolute inset-0 flex items-center justify-center bg-black/45">

                <Loader2 className="h-6 w-6 animate-spin text-white" />

              </div>
            )}


            {!uploading &&
              onRemove && (
                <button
                  type="button"
                  onClick={
                    onRemove
                  }
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

          </div>


          <div className="flex items-center justify-between gap-3 px-4 py-3">

            <p className="text-xs text-[#84969D]">
              Image uploaded
            </p>


            <button
              type="button"
              disabled={uploading}
              onClick={() =>
                inputRef.current
                  ?.click()
              }
              className="flex items-center gap-2 text-xs font-semibold text-[#087F8C]"
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
            inputRef.current
              ?.click()
          }
          className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBDCDF] bg-[#FAFCFC] px-6 text-center hover:border-[#2CC3D0]"
        >

          {uploading ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-[#0BA3B1]" />

              <p className="mt-4 text-sm font-semibold text-[#506B73]">
                Uploading...
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