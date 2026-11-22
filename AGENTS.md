# Working on House Music

## Writing and design

Use short, concrete language in code, documentation and controls. Use the names players see in the house. Give errors a remedy, such as “Move the lamp inside the room.” Write the README for someone opening the game for the first time.

Build occult clues around details a player can see or hear. Give them enough evidence to choose their next move. If a clue sends players looking for the wrong object, revise the clue around the furnishing they recognise. Discuss new discoveries before building them.

Keep contributor instructions here. Publish design plans and puzzle explanations in [docs/puzzles](docs/puzzles/). Keep prompts, task checklists, review notes and handoffs in the private planning folder. Game text describes the world and its controls. Comments explain a decision that names and tests cannot convey. Delete obsolete code and comments outright.

## Code organisation

- `web/building/` holds the house model. `HouseEditor` owns edits and undo. `FloorPlan` checks placement for both furniture drops and imported houses.
- In `web/music/`, `Score` derives notes from a house, `Transport` schedules them and `Sampler` plays the recordings.
- In `web/scene/`, `HouseScene` uses the same geometry to draw and pick furniture.
- `web/library/` owns local saves and validates the house format for files and share links.
- In `web/ui/`, `BuildControls` turns gestures into edits. `web/main.js` connects the services.

Give each rule one owner. Prefer small service classes for operations that share state or behaviour. Keep house snapshots and catalogue entries as plain records. Keep a short calculation beside its caller. Build for the current house format and change its readers and tests together.

## Checks and commits

Use the smallest house that demonstrates the behaviour under test. Exercise a public operation and check the layout, sound or saved result. Run `npm test`. For timing changes, listen through two passes. For placement changes, try a mouse and a touchscreen. Keep source credits with the recordings that ship.

The default branch is `trunk`. Use Conventional Commits with an imperative description, such as `fix: preserve the downbeat when a room moves`. Keep each commit focused on one change.
