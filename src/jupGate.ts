/**
 * Global Jupiter datapi audit gate.
 *
 * Endpoint: https://datapi.jup.ag/v1/assets/search?query=<mint>
 * We extract two per-token quality signals:
 *   - fees               (number; higher = more organic volume)
 *   - organicScoreLabel  ("low" | "medium" | "high" | null)
 *
 * Backtest on recent live universes showed:
 *   GMGN trending:  fees ≥ 1 AND score ∈ {medium, high} nearly DOUBLES win rate.
 *   OKX hot-tokens: filter adds no edge, but user accepted fewer fires for
 *                   cross-source consistency.
 *
 * Rules:
 *   - On transient Jup failure (network error or 4xx) we DEFAULT TO PASS — Jup
 *     is not load-bearing here and we don't want outages to block entries.
 *   - 5s timeout, no retries.
 *   - 5-minute in-memory TTL cache per mint to avoid hammering Jup during
 *     burst polls when multiple sources deep-dive the same token.
 */

import logger from "./logger.js";

const BASE_URL = "https://datapi.jup.ag/v1/assets/search";
const TTL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

export type JupAudit = {
  fees: number;
  organicScoreLabel: string;
};

export type JupGateConfig = {
  enabled: boolean;
  minFees: number;
  allowedScoreLabels: string[];
};

type CacheEntry = { at: number; value: JupAudit | null };
const cache = new Map<string, CacheEntry>();

function pickFirstRow(json: unknown, mint: string): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const maybeList = Array.isArray(json)
    ? json
    : Array.isArray((json as Record<string, unknown>).data)
      ? ((json as Record<string, unknown>).data as unknown[])
      : null;
  if (!maybeList) return null;
  const match = maybeList.find(
    (row) =>
      row &&
      typeof row === "object" &&
      ((row as Record<string, unknown>).id === mint || (row as Record<string, unknown>).mint === mint),
  );
  const first = (match ?? maybeList[0]) as Record<string, unknown> | undefined;
  return first && typeof first === "object" ? first : null;
}

export async function fetchJupAudit(mint: string): Promise<JupAudit | null> {
  const cached = cache.get(mint);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}?query=${encodeURIComponent(mint)}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn({ mint, status: res.status }, "[jup-gate] non-OK response");
      cache.set(mint, { at: Date.now(), value: null });
      return null;
    }
    const json = (await res.json()) as unknown;
    const row = pickFirstRow(json, mint);
    if (!row) {
      cache.set(mint, { at: Date.now(), value: null });
      return null;
    }
    const feesRaw = row.fees;
    const labelRaw = row.organicScoreLabel;
    const fees = typeof feesRaw === "number" ? feesRaw : Number(feesRaw ?? 0);
    const organicScoreLabel =
      typeof labelRaw === "string" && labelRaw.trim() ? labelRaw.trim().toLowerCase() : "";
    const audit: JupAudit = {
      fees: Number.isFinite(fees) ? fees : 0,
      organicScoreLabel,
    };
    cache.set(mint, { at: Date.now(), value: audit });
    return audit;
  } catch (err) {
    logger.warn({ mint, err: (err as Error).message }, "[jup-gate] fetch failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type JupGateResult = { ok: true } | { ok: false; reason: string };

export function passesJupGate(audit: JupAudit | null, cfg: JupGateConfig): JupGateResult {
  if (!cfg.enabled) return { ok: true };
  // Transient Jup failures (network error, 4xx, parse failure) → pass.
  // Jup isn't load-bearing; don't block entries when Jup is down.
  if (audit == null) return { ok: true };

  if (audit.fees < cfg.minFees) {
    return {
      ok: false,
      reason: `jup-gate: fees ${audit.fees} < ${cfg.minFees}`,
    };
  }

  const allow = cfg.allowedScoreLabels ?? [];
  if (allow.length > 0) {
    const normalized = audit.organicScoreLabel.toLowerCase();
    const allowLower = allow.map((s) => s.toLowerCase());
    if (!normalized || !allowLower.includes(normalized)) {
      return {
        ok: false,
        reason: `jup-gate: score "${audit.organicScoreLabel || "unknown"}" not in ${allow.join("|")}`,
      };
    }
  }

  return { ok: true };
}

export function formatJupGate(cfg: JupGateConfig): string {
  if (!cfg.enabled) return "disabled";
  const labels = cfg.allowedScoreLabels.length > 0 ? cfg.allowedScoreLabels.join("|") : "any";
  return `fees ≥ ${cfg.minFees} · score ∈ ${labels}`;
}
