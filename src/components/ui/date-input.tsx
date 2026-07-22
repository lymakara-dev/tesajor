import * as React from "react"
import { CalendarDays } from "lucide-react"

import { cn } from "@/lib/utils"

function DateInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <CalendarDays
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.5}
      />
      <input
        type="date"
        data-slot="date-input"
        className={cn(
          "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent py-2 pr-3 pl-9 text-base leading-normal transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100",
          className
        )}
        {...props}
      />
    </div>
  )
}

export { DateInput }
