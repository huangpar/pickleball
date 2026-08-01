"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ParticipantPicker } from "./ParticipantPicker";
import {
  computeSinglesPreview,
  computeFixedDoublesPreview,
  computeRotatingDoublesPreview,
  computeHybridDoublesPreview,
} from "@/lib/scheduling/preview";
import type { PlayerRow } from "@/lib/data/players";

type MatchFormat = "singles" | "doubles";
type TeamMode = "fixed" | "rotating" | "hybrid";

export function RoundRobinSetupForm({
  initialPlayers,
  onSubmit,
  onCreatePlayer,
}: {
  initialPlayers: PlayerRow[];
  onSubmit: (formData: FormData) => Promise<string>;
  onCreatePlayer: (formData: FormData) => Promise<PlayerRow>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [numCourts, setNumCourts] = useState<number | "">(2);
  const [matchDurationMinutes, setMatchDurationMinutes] = useState(30);
  const [matchFormat, setMatchFormat] = useState<MatchFormat>("singles");
  const [teamMode, setTeamMode] = useState<TeamMode>("fixed");
  const [numRounds, setNumRounds] = useState<number | "">(12);
  const [availablePlayers, setAvailablePlayers] = useState<PlayerRow[]>(initialPlayers);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockedPairs, setLockedPairs] = useState<[string, string][]>([]);
  const [armedId, setArmedId] = useState<string | null>(null);

  const playersById = useMemo(() => new Map(availablePlayers.map((p) => [p.id, p])), [availablePlayers]);

  const fixedTeams: [string, string][] =
    matchFormat === "doubles" && teamMode === "fixed"
      ? Array.from({ length: Math.floor(selectedOrder.length / 2) }, (_, i) => [
          selectedOrder[i * 2],
          selectedOrder[i * 2 + 1],
        ])
      : [];

  const rotatingPlayerIds =
    matchFormat === "doubles" && teamMode === "hybrid"
      ? selectedOrder.filter((id) => !lockedPairs.some((pair) => pair.includes(id)))
      : [];

  const preview = useMemo(() => {
    const courts = numCourts === "" ? 0 : numCourts;
    const rounds = numRounds === "" ? 0 : numRounds;
    if (matchFormat === "singles") {
      return computeSinglesPreview(selectedOrder.length, courts, matchDurationMinutes);
    }
    if (teamMode === "fixed") {
      return computeFixedDoublesPreview(fixedTeams.length, courts, matchDurationMinutes);
    }
    if (teamMode === "hybrid") {
      return computeHybridDoublesPreview(lockedPairs.length, rotatingPlayerIds.length, courts, matchDurationMinutes, rounds);
    }
    return computeRotatingDoublesPreview(selectedOrder.length, courts, matchDurationMinutes, rounds);
  }, [
    matchFormat,
    teamMode,
    selectedOrder.length,
    numCourts,
    matchDurationMinutes,
    numRounds,
    fixedTeams.length,
    lockedPairs.length,
    rotatingPlayerIds.length,
  ]);

  function toggleParticipant(id: string) {
    setSelectedOrder((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    setLockedPairs((prev) => prev.filter((pair) => !pair.includes(id)));
    setArmedId((prev) => (prev === id ? null : prev));
  }

  function handlePairClick(id: string) {
    const existingPair = lockedPairs.find((pair) => pair.includes(id));
    if (existingPair) {
      setLockedPairs((prev) => prev.filter((pair) => pair !== existingPair));
      return;
    }
    if (armedId === null) {
      setArmedId(id);
    } else if (armedId === id) {
      setArmedId(null);
    } else {
      setLockedPairs((prev) => [...prev, [armedId, id]]);
      setArmedId(null);
    }
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("numCourts", String(numCourts));
      formData.set("matchDurationMinutes", String(matchDurationMinutes));
      formData.set("matchFormat", matchFormat);
      selectedOrder.forEach((id) => formData.append("participantIds", id));

      if (matchFormat === "doubles") {
        formData.set("teamMode", teamMode);
        if (teamMode === "rotating") {
          formData.set("numRounds", String(numRounds));
        } else if (teamMode === "hybrid") {
          formData.set("numRounds", String(numRounds));
          lockedPairs.forEach((pair) => formData.append("fixedPairs", pair.join(",")));
        } else {
          fixedTeams.forEach((team) => formData.append("fixedTeams", team.join(",")));
        }
      }

      const tournamentId = await onSubmit(formData);
      router.push(`/tournaments/${tournamentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="space-y-4">
        <h2 className="font-headline text-lg font-semibold">Parameters</h2>

        <label className="flex flex-col text-sm gap-1">
          Tournament Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-outline-variant rounded px-3 py-2"
          />
        </label>

        <label className="flex flex-col text-sm gap-1">
          Number of Courts
          <input
            type="number"
            min={1}
            value={numCourts}
            onChange={(e) => setNumCourts(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-outline-variant rounded px-3 py-2"
          />
        </label>

        {/* <label className="flex flex-col text-sm gap-1">
          Match Duration (minutes)
          <input
            type="number"
            min={1}
            value={matchDurationMinutes}
            onChange={(e) => setMatchDurationMinutes(Number(e.target.value))}
            className="border border-outline-variant rounded px-3 py-2"
          />
        </label> */}

        <fieldset className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="matchFormat"
              checked={matchFormat === "singles"}
              onChange={() => setMatchFormat("singles")}
              aria-label="Singles"
            />
            Singles
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="matchFormat"
              checked={matchFormat === "doubles"}
              onChange={() => setMatchFormat("doubles")}
              aria-label="Doubles"
            />
            Doubles
          </label>
        </fieldset>

        {matchFormat === "doubles" && (
          <>
            <hr className="border-outline-variant/30" />
            <fieldset className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="teamMode"
                  checked={teamMode === "fixed"}
                  onChange={() => setTeamMode("fixed")}
                  aria-label="Fixed Teams"
                />
                Fixed Teams
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="teamMode"
                  checked={teamMode === "rotating"}
                  onChange={() => setTeamMode("rotating")}
                  aria-label="Rotating Partners"
                />
                Rotating Partners
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="teamMode"
                  checked={teamMode === "hybrid"}
                  onChange={() => setTeamMode("hybrid")}
                  aria-label="Hybrid"
                />
                Hybrid
              </label>
            </fieldset>
          </>
        )}

        {matchFormat === "doubles" && (teamMode === "rotating" || teamMode === "hybrid") && (
          <label className="flex flex-col text-sm gap-1">
            Number of Rounds
            <input
              type="number"
              min={1}
              value={numRounds}
              onChange={(e) => setNumRounds(e.target.value === "" ? "" : Number(e.target.value))}
              className="border border-outline-variant rounded px-3 py-2"
            />
          </label>
        )}

        {matchFormat === "doubles" && teamMode === "fixed" && fixedTeams.length > 0 && (
          <div>
            <h3 className="font-headline text-sm font-semibold mb-2">Teams (paired in selection order)</h3>
            <ul className="space-y-1">
              {fixedTeams.map(([a, b], i) => (
                <li key={i} className="font-body text-sm">
                  {playersById.get(a)?.name} &amp; {playersById.get(b)?.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {matchFormat === "doubles" && teamMode === "hybrid" && lockedPairs.length > 0 && (
          <div>
            <h3 className="font-headline text-sm font-semibold mb-2">Fixed Pairs</h3>
            <ul className="space-y-1">
              {lockedPairs.map(([a, b], i) => (
                <li key={i} className="font-body text-sm">
                  {playersById.get(a)?.name} &amp; {playersById.get(b)?.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-headline text-lg font-semibold">Participants</h2>
        <ParticipantPicker
          availablePlayers={availablePlayers}
          selectedIds={selectedOrder}
          onToggle={toggleParticipant}
          onPlayerAdded={(player) => setAvailablePlayers((prev) => [...prev, player])}
          onCreatePlayer={onCreatePlayer}
          pairLocking={
            matchFormat === "doubles" && teamMode === "hybrid"
              ? { lockedPairs, armedId, onPairClick: handlePairClick }
              : undefined
          }
        />
      </Card>

      <Card className="lg:col-span-2 flex items-center justify-between">
        <div>
          <p className="font-headline text-lg font-semibold">
            {preview.totalMatches} matches &middot; ~{Math.round(preview.estimatedMinutes / 60)} hours estimated
          </p>
          {error && <p className="text-error text-sm mt-1">{error}</p>}
        </div>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Generating..." : "Generate Bracket"}
        </Button>
      </Card>
    </div>
  );
}
