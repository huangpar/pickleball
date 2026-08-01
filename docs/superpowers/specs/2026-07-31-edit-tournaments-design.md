# Edit Tournaments — Design

## Summary

Allow users to edit tournament participants and number of rounds before any matches are played. When either field changes, all scheduled matches are regenerated from scratch using the updated configuration.

## Scope

- **Editable fields:** Participants list and number of rounds
- **Locked fields:** Tournament name, match format, team mode (these define the fundamental tournament structure and cannot be changed)
- **Edit availability:** Only when tournament status is "setup" (no matches played yet)
- **Match regeneration:** Automatic, full regeneration if any editable field changes

## Data Layer

No new database schema. Uses existing columns:
- `tournaments.status` — must be "setup" to allow editing
- `tournamentParticipants` — updated to add/remove participants
- `tournaments.numRounds` — updated if rounds changed
- `matches` and `matchParticipants` — deleted and regenerated

## Server Action

New action in `lib/actions/tournaments.ts`:

```ts
export async function editTournament(
  tournamentId: string,
  participantIds: string[],
  numRounds: number
): Promise<void>
```

**Validation:**
- Tournament exists
- Tournament status is "setup" (not "scheduled", "in_progress", "completed")
- participantIds.length >= 2
- numRounds >= 1 (if applicable)
- For doubles mode: participant count is even (if fixed teams) or >= 4 (if rotating/hybrid)

**Steps:**
1. Fetch tournament (validate status)
2. Delete all matches and match_participants for this tournament
3. Update tournament.numRounds if changed
4. Update tournamentParticipants (remove old, insert new)
5. Regenerate bracket using the same logic as `generateBracket` (existing scheduler functions)
6. Revalidate caches (`/tournaments`, `/tournaments/[id]`)

## UI

**Tournament Detail Page (`app/tournaments/[id]/page.tsx`):**
- Show "Edit" button only when tournament.status === "setup"
- Button opens modal/dialog with:
  - Participant picker (showing current participants, allowing add/remove)
  - Rounds input (if applicable: rotating or hybrid mode)
  - "Save changes" button + "Cancel" button
  - Confirmation message if changing participants/rounds

**Tournaments List (`app/tournaments/page.tsx`):**
- Add small edit icon (pencil) on each tournament row/card
- Icon visible only for tournaments in "setup" status
- Clicking icon navigates to tournament detail page (or opens modal if implemented inline)
- Or: Opens the same modal as the detail page

**Modal Implementation:**
- Title: "Edit Tournament"
- Reuse ParticipantPicker component (already in place from setup form)
- Reuse rounds input (number field)
- Pre-populate with current values
- Show loading state while saving
- On success: Close modal, refresh tournament detail page
- On error: Show error message, allow retry

## Testing

**Unit tests** (`lib/actions/tournaments.test.ts`):
- Rejects edit if tournament not in "setup" status
- Rejects if less than 2 participants
- Successfully updates participants only
- Successfully updates rounds only
- Successfully updates both participants and rounds
- Regenerates matches correctly (count matches, verify pairings)
- Verifies old matches are deleted before new ones created
- Handles edge cases (removing all participants except 2, changing team mode constraints)

**Integration tests:**
- Edit flow end-to-end: open tournament → edit participants → save → verify new bracket

**UI tests** (`components/tournaments/*.test.tsx`):
- Edit button visible only in setup status
- Edit button hidden in scheduled/in_progress/completed status
- Modal opens with current values pre-filled
- Modal closes on cancel
- Modal submits and calls editTournament on save
- Error message shown if submission fails

## Success Criteria

- ✅ Users can edit participants and rounds for setup-status tournaments
- ✅ Edit option visible only when allowed (setup status)
- ✅ Changing participants regenerates all matches
- ✅ Changing rounds regenerates all matches
- ✅ All old matches deleted before new ones created
- ✅ Tournament detail page reflects changes immediately
- ✅ Participants list can grow/shrink without breaking constraints
- ✅ No regressions to existing tournament creation/display
