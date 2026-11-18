"use client";

import CountUp from "@/components/bits/CountUp";

/**
 * Counts a stat like "100+" or "~2" up from zero when it scrolls into view.
 * Anything that isn't a plain number with an optional prefix and suffix is shown as-is.
 */
export function StatCount({ value }: { value: string }) {
  const match = /^([^\d]*)(\d+(?:\.\d+)?)([^\d]*)$/.exec(value);
  if (!match) return <>{value}</>;
  const [, prefix, num, suffix] = match;
  return <CountUp to={Number(num)} prefix={prefix} suffix={suffix} duration={1.6} easing="expo" />;
}
