import type { State } from "../types";
import { fmtUptime } from "../lib/format";
import { useEffect, useState } from "react";

type Props = { state: State | null; error: string | null };

/**
 * Slim 56px glass-effect top app bar.
 *  - Left:  🌙 MOONBAGS wordmark + glowing dot + LIVE / DRY / DISCONNECTED pill
 *  - Right: compact OPEN / REALIZED / UPTIME stats with thin vertical dividers
 */
export function TopBar({ state, error }: Props) {
  // tick once a second so uptime display stays fresh
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const dry = state?.stats.dryRun ?? state?.config.DRY_RUN ?? false;
  const openCount = state?.stats.openCount ?? 0;
  const maxConc = state?.stats.maxConcurrent ?? state?.config.MAX_CONCURRENT_POSITIONS ?? 0;
  const pnl = state?.stats.realizedPnlSol ?? 0;
  const bootAt = state?.stats.bootAt ?? Date.now();
  const uptimeMs = Date.now() - bootAt;
  const pnlPositive = pnl >= 0;
  const heartbeatSecs = state?.config.PRICE_POLL_MS
    ? `${Math.max(1, Math.round(state.config.PRICE_POLL_MS / 1000))}s`
    : "—";
  const modeValue = dry ? "DRY" : "LIVE";

  // status pill: ERROR > DRY > LIVE > CONNECTING
  const statusPill = (() => {
    if (error) {
      return (
        <span className="px-2 py-0.5 bg-coral/20 text-coral text-[10px] font-mono font-bold tracking-widest border border-coral/40 rounded-sm">
          DISCONNECTED
        </span>
      );
    }
    if (!state) {
      return (
        <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-mono font-bold tracking-widest border border-border rounded-sm">
          CONNECTING
        </span>
      );
    }
    if (dry) {
      return (
        <span className="px-2 py-0.5 bg-earth/20 text-earth text-[10px] font-mono font-bold tracking-widest border border-earth/40 rounded-sm">
          DRY RUN
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-pepe/20 text-pepe text-[10px] font-mono font-bold tracking-widest border border-pepe/40 rounded-sm">
        LIVE
      </span>
    );
  })();

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-pepe/10 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-foreground tracking-tight font-display flex items-center gap-2">
            <span className="text-2xl text-pepe">◔</span>
            MOONBAGS
            <span
              className="flex h-2 w-2 rounded-full bg-pepe motion-safe:animate-pulse shadow-[0_0_8px_hsl(89_53%_44%)]"
              aria-hidden="true"
            />
          </span>
          <div className="ml-1" role="status" aria-live="polite">{statusPill}</div>
        </div>

        <nav
          className="hidden md:flex items-stretch divide-x divide-outline-variant/20 overflow-hidden rounded-md border border-outline-variant/20 bg-surface-container-low/60"
          aria-label="Bot status"
        >
          <Stat label="Open Positions" value={`${openCount} / ${maxConc}`} />
          <Stat label="Realized" value={`${pnlPositive ? "+" : ""}${pnl.toFixed(2)} SOL`} valueClassName={pnlPositive ? "text-pepe" : "text-coral"} />
          <Stat label="Heartbeat" value={heartbeatSecs} />
          <Stat label="Uptime" value={fmtUptime(uptimeMs)} />
          <Stat label="Mode" value={modeValue} valueClassName={dry ? "text-earth" : "text-pepe"} />
        </nav>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-[108px] flex-col justify-center px-4 py-2">
      <span className="text-zinc-500 font-mono text-[9px] uppercase tracking-[0.18em]">{label}</span>
      <span className={`font-mono font-bold text-sm tabular-nums ${valueClassName}`}>{value}</span>
    </div>
  );
}
