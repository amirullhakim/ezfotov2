"use client"

import {
  BrainCircuit,
  Camera,
  CheckCircle2,
  FileSearch,
  ImageIcon,
  Loader2,
  ScanFace,
  Square,
  XCircle,
} from "lucide-react"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import { apiFetch } from "@/lib/api"


type EventStatus =
  | "DRAFT"
  | "LIVE"
  | "CLOSED"


type ProcessingStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"


type ProcessingJob = {
  has_job: boolean

  job_id: string | null
  event_id: string | null

  status: ProcessingStatus | null

  total_files: number
  processed_files: number
  ready_files: number
  failed_files: number
  pending_files: number

  progress_percentage: number

  current_photo_id: string | null
  current_filename: string | null

  message: string | null

  cancel_requested: boolean
  is_running: boolean

  started_at: string | null
  completed_at: string | null

  created_at: string | null
  updated_at: string | null
}


export default function EventProcessingCard({
  eventId,
  eventStatus,
  photoTotal,
}: {
  eventId: string
  eventStatus: EventStatus
  photoTotal: number
}) {
  const [
    job,
    setJob,
  ] = useState<ProcessingJob | null>(
    null
  )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("")

  const [
    statusMessage,
    setStatusMessage,
  ] = useState("")


  const loadStatus =
    useCallback(
      async (
        quiet = false
      ) => {
        if (!quiet) {
          setLoading(true)
        }

        try {
          const result =
            await apiFetch<ProcessingJob>(
              `/api/event-sales/events/${eventId}/processing`
            )

          setJob(
            result
          )

        } catch (error) {
          if (!quiet) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Unable to load AI processing status."
            )
          }

        } finally {
          if (!quiet) {
            setLoading(false)
          }
        }
      },
      [eventId]
    )


  useEffect(() => {
    loadStatus()
  }, [loadStatus])


  useEffect(() => {
    if (
      !job?.is_running
    ) {
      return
    }


    const timer =
      window.setInterval(
        () => {
          loadStatus(
            true
          )
        },
        3000
      )


    return () => {
      window.clearInterval(
        timer
      )
    }

  }, [
    job?.is_running,
    loadStatus,
  ])


  async function startProcessing() {
    setActionLoading(true)
    setErrorMessage("")
    setStatusMessage("")


    try {
      const result =
        await apiFetch<ProcessingJob>(
          `/api/event-sales/events/${eventId}/processing/start`,
          {
            method:
              "POST",
          }
        )


      setJob(
        result
      )


      setStatusMessage(
        "AI processing job created successfully."
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start AI processing."
      )

    } finally {
      setActionLoading(false)
    }
  }


  async function cancelProcessing() {
    const confirmed =
      window.confirm(
        "Cancel this AI processing job?"
      )

    if (!confirmed) {
      return
    }


    setActionLoading(true)
    setErrorMessage("")
    setStatusMessage("")


    try {
      const result =
        await apiFetch<ProcessingJob>(
          `/api/event-sales/events/${eventId}/processing/cancel`,
          {
            method:
              "POST",
          }
        )


      setJob(
        result
      )


      setStatusMessage(
        result.status === "CANCELLED"
          ? "AI processing job cancelled."
          : "Cancellation requested."
      )

    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to cancel AI processing."
      )

    } finally {
      setActionLoading(false)
    }
  }


  const canStart =
    useMemo(
      () =>
        eventStatus
          !== "CLOSED"
        && photoTotal > 0
        && !job?.is_running,
      [
        eventStatus,
        photoTotal,
        job?.is_running,
      ]
    )


  if (loading) {
    return (
      <section className="mt-6 rounded-[28px] border border-[#DDE8EA] bg-white p-6 lg:p-7">

        <div className="flex items-center gap-3 text-sm font-semibold text-[#60777F]">

          <Loader2 className="h-5 w-5 animate-spin text-[#0A9CA8]" />

          Loading AI processing...

        </div>

      </section>
    )
  }


  return (
    <section className="mt-6 overflow-hidden rounded-[28px] border border-[#DDE8EA] bg-white shadow-[0_10px_30px_rgba(16,55,65,0.03)]">

      {/* HEADER */}
      <div className="border-b border-[#E5EDEF] p-6 lg:p-7">

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">

          <div className="flex gap-4">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E4F7F8] text-[#0A929F]">
              <BrainCircuit className="h-5 w-5" />
            </div>


            <div>

              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">
                AI pipeline
              </p>

              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-[#173943]">
                AI Processing
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#758B92]">
                Prepare watermarked previews, detect race bibs and build face-search indexes for your event photos.
              </p>

            </div>

          </div>


          {job?.has_job
            && job.status && (

            <ProcessingStatusBadge
              status={
                job.status
              }
            />

          )}

        </div>


        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <PipelineFeature
            icon={
              ImageIcon
            }
            title="Watermark"
            description="Protected customer previews"
          />

          <PipelineFeature
            icon={
              FileSearch
            }
            title="Bib detection"
            description="YOLOv8 detection"
          />

          <PipelineFeature
            icon={
              Camera
            }
            title="Bib OCR"
            description="EasyOCR recognition"
          />

          <PipelineFeature
            icon={
              ScanFace
            }
            title="Face search"
            description="ArcFace embeddings"
          />

        </div>

      </div>


      {/* BODY */}
      <div className="p-6 lg:p-7">

        {(errorMessage
          || statusMessage) && (

          <div
            className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
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


        {!job?.has_job ? (

          <IdleState
            photoTotal={
              photoTotal
            }
            eventStatus={
              eventStatus
            }
            canStart={
              canStart
            }
            loading={
              actionLoading
            }
            onStart={
              startProcessing
            }
          />

        ) : (

          <JobState
            job={
              job
            }
            photoTotal={
              photoTotal
            }
            eventStatus={
              eventStatus
            }
            canStart={
              canStart
            }
            actionLoading={
              actionLoading
            }
            onStart={
              startProcessing
            }
            onCancel={
              cancelProcessing
            }
          />

        )}

      </div>

    </section>
  )
}


function IdleState({
  photoTotal,
  eventStatus,
  canStart,
  loading,
  onStart,
}: {
  photoTotal: number
  eventStatus: EventStatus
  canStart: boolean
  loading: boolean
  onStart: () => void
}) {
  return (
    <div className="flex flex-col justify-between gap-5 rounded-2xl border border-[#DFE9EB] bg-[#F9FBFC] p-5 sm:flex-row sm:items-center">

      <div>

        <p className="text-sm font-semibold text-[#355760]">
          {photoTotal > 0
            ? `${photoTotal} photo${photoTotal === 1 ? "" : "s"} ready for processing`
            : "No photos waiting for processing"}
        </p>


        <p className="mt-1 text-xs leading-5 text-[#81949A]">
          {eventStatus === "CLOSED"
            ? "Reopen this event as a draft before starting AI processing."
            : photoTotal > 0
              ? "Start a processing job when your uploads are ready."
              : "Upload event photos before starting the AI pipeline."}
        </p>

      </div>


      <button
        type="button"
        disabled={
          !canStart
          || loading
        }
        onClick={
          onStart
        }
        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-5 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-45"
      >

        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <BrainCircuit className="h-4 w-4" />
        )}

        Start AI Processing
      </button>

    </div>
  )
}


function JobState({
  job,
  photoTotal,
  eventStatus,
  canStart,
  actionLoading,
  onStart,
  onCancel,
}: {
  job: ProcessingJob
  photoTotal: number
  eventStatus: EventStatus
  canStart: boolean
  actionLoading: boolean
  onStart: () => void
  onCancel: () => void
}) {
  const running =
    job.is_running


  return (
    <div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <JobStat
          label="Total"
          value={
            job.total_files
              .toString()
          }
        />

        <JobStat
          label="Processed"
          value={
            `${job.processed_files} / ${job.total_files}`
          }
        />

        <JobStat
          label="Ready"
          value={
            job.ready_files
              .toString()
          }
        />

        <JobStat
          label="Failed"
          value={
            job.failed_files
              .toString()
          }
        />

      </div>


      <div className="mt-6">

        <div className="flex items-center justify-between gap-4">

          <p className="text-sm font-semibold text-[#365760]">
            Progress
          </p>

          <p className="text-sm font-semibold text-[#267985]">
            {job.progress_percentage}%
          </p>

        </div>


        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#E5EDEF]">

          <div
            className="h-full rounded-full bg-[#16A5B2] transition-all duration-500"
            style={{
              width:
                `${job.progress_percentage}%`,
            }}
          />

        </div>


        <div className="mt-4 rounded-2xl border border-[#E1E9EB] bg-[#FAFCFC] p-4">

          <div className="flex items-start gap-3">

            {job.status
              === "COMPLETED" ? (

              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#288069]" />

            ) : job.status
              === "FAILED"
              || job.status
                === "CANCELLED" ? (

              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#A95A65]" />

            ) : (

              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#168F9B]" />

            )}


            <div className="min-w-0">

              <p className="text-sm font-semibold text-[#355760]">
                {jobTitle(
                  job
                )}
              </p>


              {job.current_filename && (

                <p className="mt-1 text-xs font-medium text-[#617B83]">
                  Current photo:{" "}
                  {job.current_filename}
                </p>

              )}


              <p className="mt-1 text-xs leading-5 text-[#81949A]">
                {job.message
                  || defaultJobMessage(
                    job.status
                  )}
              </p>

            </div>

          </div>

        </div>

      </div>


      <div className="mt-5 flex flex-wrap justify-end gap-3">

        {running && (

          <button
            type="button"
            disabled={
              actionLoading
              || job.cancel_requested
            }
            onClick={
              onCancel
            }
            className="flex h-10 items-center gap-2 rounded-xl border border-[#E3DCDD] bg-white px-4 text-sm font-semibold text-[#8F5E66] transition hover:bg-[#FFF7F8] disabled:opacity-50"
          >

            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}

            {job.cancel_requested
              ? "Cancelling..."
              : "Cancel processing"}

          </button>

        )}


        {!running
          && canStart
          && photoTotal > 0
          && eventStatus
            !== "CLOSED" && (

          <button
            type="button"
            disabled={
              actionLoading
            }
            onClick={
              onStart
            }
            className="flex h-10 items-center gap-2 rounded-xl bg-[#073B4C] px-4 text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:opacity-50"
          >

            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BrainCircuit className="h-4 w-4" />
            )}

            Start new processing job

          </button>

        )}

      </div>

    </div>
  )
}


function PipelineFeature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Camera
  title: string
  description: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#E1E9EB] bg-[#FAFCFC] p-3.5">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E9F7F8] text-[#188B97]">
        <Icon className="h-4 w-4" />
      </div>


      <div className="min-w-0">

        <p className="text-xs font-semibold text-[#395A63]">
          {title}
        </p>

        <p className="mt-0.5 truncate text-[11px] text-[#899BA1]">
          {description}
        </p>

      </div>

    </div>
  )
}


function JobStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-[#E0E9EB] bg-[#FAFCFC] px-4 py-3.5">

      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87999F]">
        {label}
      </p>

      <p className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[#294B54]">
        {value}
      </p>

    </div>
  )
}


function ProcessingStatusBadge({
  status,
}: {
  status: ProcessingStatus
}) {
  const styles: Record<
    ProcessingStatus,
    string
  > = {
    QUEUED:
      "border-[#D7E6E9] bg-[#F7FAFB] text-[#647D85]",

    PROCESSING:
      "border-[#BFE3E7] bg-[#EFF9FA] text-[#247B86]",

    COMPLETED:
      "border-[#CBE9DF] bg-[#EFFAF6] text-[#21745F]",

    FAILED:
      "border-[#F0D7DB] bg-[#FFF6F7] text-[#A95460]",

    CANCELLED:
      "border-[#E4DFE0] bg-[#FAF7F7] text-[#816C71]",
  }


  return (
    <span
      className={`w-fit rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${styles[status]}`}
    >
      {status}
    </span>
  )
}


function jobTitle(
  job: ProcessingJob
) {
  if (
    job.status
    === "QUEUED"
  ) {
    return "AI processing queued"
  }

  if (
    job.status
    === "PROCESSING"
  ) {
    return "AI processing in progress"
  }

  if (
    job.status
    === "COMPLETED"
  ) {
    return "AI processing completed"
  }

  if (
    job.status
    === "FAILED"
  ) {
    return "AI processing failed"
  }

  return "AI processing cancelled"
}


function defaultJobMessage(
  status: ProcessingStatus | null
) {
  if (
    status
    === "QUEUED"
  ) {
    return "Waiting for an AI worker to begin processing."
  }

  if (
    status
    === "PROCESSING"
  ) {
    return "Processing event photographs."
  }

  if (
    status
    === "COMPLETED"
  ) {
    return "All photographs in this job have finished processing."
  }

  if (
    status
    === "FAILED"
  ) {
    return "The processing job encountered an error."
  }

  if (
    status
    === "CANCELLED"
  ) {
    return "The processing job was cancelled."
  }

  return ""
}