import { useEffect, useState } from "react";
import { ENGINE_URL } from "@/lib/constants";

export interface EngineStatus {
  isFrozen:    boolean;
  ready:       boolean;  // false until first successful fetch
}

const DEFAULT: EngineStatus = { isFrozen: false, ready: false };

export function useEngineStatus(): EngineStatus {
  const [status, setStatus] = useState<EngineStatus>(DEFAULT);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch(`${ENGINE_URL}/api/status`, {
          signal: AbortSignal.timeout(2000),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setStatus({
          isFrozen: Boolean(data.isFrozen),
          ready:    true,
        });
      } catch {
        // engine might be offline — don't crash UI
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return status;
}
