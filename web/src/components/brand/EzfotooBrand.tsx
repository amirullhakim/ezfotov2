import { Camera } from "lucide-react"

type EzfotooBrandProps = {
  compact?: boolean
}

export function EzfotooBrand({
  compact = false,
}: EzfotooBrandProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#073B4C] shadow-sm">
        <Camera
          className="h-6 w-6 text-[#36D4DF]"
          strokeWidth={2}
        />
      </div>

      {!compact && (
        <div>
          <div className="text-[22px] font-bold tracking-[-0.04em] text-[#073B4C]">
            EZFOTOO
          </div>

          <div className="mt-[-2px] text-[9px] font-semibold uppercase tracking-[0.24em] text-[#6F858D]">
            Capture · Share · Grow
          </div>
        </div>
      )}
    </div>
  )
}