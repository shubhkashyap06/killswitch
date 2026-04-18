import * as React from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThreat } from "@/context/ThreatContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NotificationBell() {
  const { events } = useThreat();
  const [hasUnread, setHasUnread] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  // Auto-set unread when new critical/warn events arrive and popover is closed
  React.useEffect(() => {
    if (!open && events.length > 0) {
      const latest = events[0];
      if (latest.level === "critical" || latest.level === "warn") {
        setHasUnread(true);
      }
    }
  }, [events, open]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setHasUnread(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-[15px] w-[15px]" strokeWidth={1.75} />
          {hasUnread && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h4 className="text-[12px] font-semibold">Security Alerts</h4>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Live Feed
          </span>
        </div>
        <ScrollArea className="h-[350px]">
          {events.length === 0 ? (
            <div className="flex h-20 items-center justify-center text-[12px] text-muted-foreground">
              No recent alerts
            </div>
          ) : (
            <div className="flex flex-col">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col border-b border-hairline/50 px-4 py-3 last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          ev.level === "info" && "bg-muted-foreground/60",
                          ev.level === "warn" && "bg-warning",
                          ev.level === "critical" && "bg-critical"
                        )}
                      />
                      <span className="text-[11px] font-medium uppercase tracking-tight text-muted-foreground">
                        {ev.source}
                      </span>
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {new Date(ev.t).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-foreground/90">
                    {ev.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-hairline px-4 py-2">
          <button 
            className="w-full text-center text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
