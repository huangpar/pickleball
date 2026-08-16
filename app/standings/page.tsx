import { getStandings } from "@/lib/data/standings";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { Button } from "@/components/Button";

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const dateRange = {
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T23:59:59.999`) : undefined,
  };
  const [standings, singlesStandings] = await Promise.all([
    getStandings(dateRange),
    getStandings(dateRange, "singles"),
  ]);

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold">Standings</h1>
        <form className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm gap-1">
            From
            <input
              type="date"
              name="from"
              defaultValue={from ?? ""}
              className="border border-outline-variant rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm gap-1">
            To
            <input
              type="date"
              name="to"
              defaultValue={to ?? ""}
              className="border border-outline-variant rounded px-3 py-2"
            />
          </label>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {(from || to) && (
            <Button href="/standings" variant="tertiary">
              Clear
            </Button>
          )}
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="font-headline text-xl font-semibold">Overall</h2>
        <StandingsTable initialStandings={standings} />
      </div>

      <div className="space-y-4">
        <h2 className="font-headline text-xl font-semibold">Singles</h2>
        <StandingsTable initialStandings={singlesStandings} />
      </div>
    </main>
  );
}
