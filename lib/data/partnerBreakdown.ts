import { getPlayerMatchHistory } from "./matchHistory";
import { computeWins, computeWinPercentage } from "@/lib/stats";

export interface OpponentRecord {
  opponentNames: string[];
  wins: number;
  losses: number;
}

export interface PartnerBreakdown {
  partnerName: string;
  wins: number;
  losses: number;
  winPercentage: number;
  opponents: OpponentRecord[];
}

export async function getPlayerPartnerBreakdown(playerId: string): Promise<PartnerBreakdown[]> {
  const history = await getPlayerMatchHistory(playerId);
  const doublesEntries = history.filter((entry) => entry.partnerNames.length > 0);

  const byPartner = new Map<string, typeof doublesEntries>();
  for (const entry of doublesEntries) {
    const partnerName = entry.partnerNames[0];
    const list = byPartner.get(partnerName) ?? [];
    list.push(entry);
    byPartner.set(partnerName, list);
  }

  const breakdowns: PartnerBreakdown[] = [];
  for (const [partnerName, entries] of byPartner) {
    const byOpponentTeam = new Map<string, OpponentRecord>();
    for (const entry of entries) {
      const sortedOpponentNames = [...entry.opponentNames].sort();
      const opponentKey = sortedOpponentNames.join(" & ");
      const record = byOpponentTeam.get(opponentKey) ?? { opponentNames: sortedOpponentNames, wins: 0, losses: 0 };
      if (entry.won) record.wins++;
      else record.losses++;
      byOpponentTeam.set(opponentKey, record);
    }

    const wins = computeWins(entries);
    breakdowns.push({
      partnerName,
      wins,
      losses: entries.length - wins,
      winPercentage: computeWinPercentage(entries),
      opponents: [...byOpponentTeam.values()].sort((a, b) =>
        a.opponentNames.join(" & ").localeCompare(b.opponentNames.join(" & "))
      ),
    });
  }

  return breakdowns.sort((a, b) => a.partnerName.localeCompare(b.partnerName));
}
