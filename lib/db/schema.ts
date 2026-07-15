import { pgTable, uuid, text, integer, numeric, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  duprRating: numeric("dupr_rating", { precision: 3, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tournaments = pgTable("tournaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  numCourts: integer("num_courts").notNull(),
  matchDurationMinutes: integer("match_duration_minutes").notNull(),
  matchFormat: text("match_format", { enum: ["singles", "doubles"] }).notNull(),
  teamMode: text("team_mode", { enum: ["fixed", "rotating"] }),
  numRounds: integer("num_rounds"),
  status: text("status", { enum: ["setup", "scheduled", "in_progress", "completed"] })
    .notNull()
    .default("setup"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tournamentParticipants = pgTable(
  "tournament_participants",
  {
    tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
    playerId: uuid("player_id").notNull().references(() => players.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.tournamentId, t.playerId] }) })
);

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
  courtNumber: integer("court_number").notNull(),
  roundNumber: integer("round_number").notNull(),
  side1Score: integer("side1_score"),
  side2Score: integer("side2_score"),
  status: text("status", { enum: ["scheduled", "final"] }).notNull().default("scheduled"),
  playedAt: timestamp("played_at"),
});

export const matchParticipants = pgTable(
  "match_participants",
  {
    matchId: uuid("match_id").notNull().references(() => matches.id),
    playerId: uuid("player_id").notNull().references(() => players.id),
    side: integer("side").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.matchId, t.playerId] }) })
);
