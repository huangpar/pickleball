"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import type { PartnerBreakdown as PartnerBreakdownData } from "@/lib/data/partnerBreakdown";

export function PartnerBreakdown({ breakdown }: { breakdown: PartnerBreakdownData[] }) {
  const [selectedPartner, setSelectedPartner] = useState("");

  if (breakdown.length === 0) return null;

  const selected = breakdown.find((b) => b.partnerName === selectedPartner);

  return (
    <Card>
      <h2 className="font-headline text-lg font-semibold mb-4">Doubles Partners</h2>
      <label className="flex flex-col text-sm gap-1 max-w-xs">
        Doubles partner
        <select
          value={selectedPartner}
          onChange={(e) => setSelectedPartner(e.target.value)}
          className="border border-outline-variant rounded px-3 py-2"
        >
          <option value="">Select a partner…</option>
          {breakdown.map((b) => (
            <option key={b.partnerName} value={b.partnerName}>
              {b.partnerName}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="mt-4 space-y-2">
          <p className="font-body font-medium">
            Overall with {selected.partnerName}: {selected.wins}-{selected.losses} · {selected.winPercentage}%
          </p>
          <ul className="divide-y divide-outline-variant/30">
            {selected.opponents.map((o) => (
              <li key={o.opponentNames.join(" & ")} className="flex items-center justify-between py-2">
                <span className="text-on-surface-variant">{o.opponentNames.join(" & ")}</span>
                <span className="font-mono font-semibold">
                  {o.wins}-{o.losses}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
