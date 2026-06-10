# Deep Cast Build Plan

Last updated: 2026-06-10

## Product Direction

Deep Cast should become a social, skill-based fishing game where players read the water, hunt strange fish, explore distinct maps, and see other anglers sharing the same world.

The current game already has a strong base: procedural 3D world, casting, boats, progression, fish species, journal/shop, Supabase-backed presence, and remote player rendering. The next work should focus on making the core loop more skillful and the world more memorable.

## Design Pillars

1. **Fishing should feel active.**
   Catching a fish should involve timing, tension, fish behavior, and player decisions, not only holding a button.

2. **The water should communicate.**
   Ripples, silhouettes, sonar pings, bubbles, lure behavior, and fish movement should give players clues.

3. **Every map should have a hook.**
   Maps should not just be recolored biomes. Each one needs a unique mechanic, mood, fish pool, named spots, and legendary rumors.

4. **Multiplayer should be visible and useful.**
   Players should see who is online, where others are fishing, what they are catching, and eventually compete or cooperate.

5. **Deep water should be the signature fantasy.**
   Depth zones, sonar, unknown contacts, abyss fish, and monster catches should make Deep Cast feel distinct.

## Phase 1: Social Presence and World Life

Goal: Make the game immediately feel shared and alive.

Features:

- Online anglers HUD: show total players online in the current map.
- Nearby player list: display names, fishing spot, mode, and current activity.
- Better floating nameplates over remote players.
- Map/spot indicators for other anglers.
- Recent catch feed: example, `RiverGhost caught a Trophy Lantern Pike`.
- Presence status states: walking, sailing, casting, waiting, reeling, caught.
- Dock crowd feel: light visual or UI changes when other players are nearby.

Implementation notes:

- Extend `LocalPresenceState` and `RemotePresenceState` with `activity`, `fishName`, and optional `lastCatch`.
- Emit multiplayer activity updates from `FishingStateMachine`.
- Add a compact `MultiplayerUI` component instead of overloading `GameUI`.
- Keep local backend compatible by returning no remotes.

Acceptance criteria:

- A player can see how many anglers are online in their current terrain.
- Remote players show stable names and smooth movement.
- Catch feed updates when another player catches a fish.

## Phase 2: Skill-Based Fish Fight

Goal: Replace the simple reel fill bar with a real fight.

Features:

- Line tension meter.
- Fish stamina meter.
- Reel progress meter.
- Holding reel gains line but increases tension.
- Releasing lowers tension but fish can regain distance.
- Tension danger zone can snap the line.
- Rod pumping: pull to tire fish, reel while lowering tension.
- Fish behavior profiles:
  - Runner: sudden long pulls.
  - Diver: tension spikes downward.
  - Darting: fast side-to-side bursts.
  - Heavy: slow progress, low burst frequency.
  - Trickster: fake rests followed by hard runs.
- Gear impact:
  - Rod affects tension forgiveness and pump strength.
  - Line affects snap threshold and max fish weight.
  - Lure affects bite behavior and fish aggression.

Implementation notes:

- Add a fight model separate from `FishingStateMachine` state transitions.
- Keep the state enum, but replace `updateReeling` internals.
- Add fish behavior data to species or derive it from rarity/difficulty.
- Update UI to show tension, stamina, progress, and danger feedback.

Acceptance criteria:

- Catching common fish is easy but still interactive.
- Rare/large fish require tension management.
- A player can fail from poor reeling, not only from missing the bite.

## Phase 3: Visible Fish and Lure Gameplay

Goal: Let players read and influence the bite.

Features:

- Fish shadows and silhouettes approach the bobber.
- Fish size and rarity subtly affect shadow scale, color, and movement.
- Lure twitch input while waiting.
- Fish can inspect, chase, reject, or bite.
- Lure categories:
  - Spinner: attracts fast fish.
  - Worm: attracts bottom fish.
  - Glow lure: attracts deep/rare fish.
  - Heavy jig: reaches deeper water.
- Surface clues:
  - Ripples for active schools.
  - Bubbles for bottom feeders.
  - Splashes for aggressive fish.
  - Brief glow for legendary/deep fish.

Implementation notes:

- Convert ambient fish from pure decoration into optional bite candidates near the bobber.
- Add a lightweight lure state: idle, twitch, pause, retrieve.
- Use existing particle system for ripples, bubbles, and bite clues.

Acceptance criteria:

- Players can see at least one fish approach before many bites.
- Twitch timing can improve bite chance.
- Different lures visibly change fish response.

## Phase 4: Unique Maps

Goal: Replace generic biome progression with memorable fishing destinations.

Each map should include:

- 3-5 named fishing spots.
- Unique water color, lighting, fog, and wave behavior.
- Unique props/background silhouettes.
- Unique fish pool and at least one legendary rumor chain.
- One map-specific mechanic.
- Multiplayer spot identity, so players can gather at known places.

Recommended maps:

### Mistfall Reservoir

- Mood: foggy old reservoir, abandoned dam, quiet forest.
- Mechanic: low visibility; sonar and ripples matter more.
- Fish: ghost trout, dam catfish, pale bass, drowned pike.
- Legendary: The Bellmouth, found near the dam during heavy fog.

### Neon Reef

- Mood: tropical night reef with glowing coral and bright fish.
- Mechanic: lure color matching affects bite chance.
- Fish: prism snapper, neon tang, coral eel, glass marlin.
- Legendary: The Chromaking, visible only during reef bloom events.

### Glacier Graveyard

- Mood: iceberg field, frozen shipwrecks, cold blue light.
- Mechanic: ice drift changes available fishing lanes.
- Fish: frost char, ice cod, shipwreck halibut, ancient sturgeon.
- Legendary: The White Hull, a giant fish circling the wreck.

### Lantern Marsh

- Mood: swamp lights, murky water, cypress roots, fireflies.
- Mechanic: night-only fish and ambush bites.
- Fish: mud gar, lantern carp, root bass, bog eel.
- Legendary: The Witchlight Gar, follows lantern patterns.

### Ashwake Caldera

- Mood: volcanic crater lake, steam vents, black rocks, lava glow.
- Mechanic: hot zones temporarily boost rare fish but raise fight difficulty.
- Fish: ember koi, basalt bass, steam eel, magma ray.
- Legendary: The Cinderjaw, appears near vent eruptions.

### The Midnight Trench

- Mood: deep ocean abyss, bioluminescent life, sonar-focused play.
- Mechanic: depth zones and unknown sonar contacts.
- Fish: lantern pike, abyss cod, glass squid, void ray.
- Legendary: The Signal Below, a co-op monster fish.

Acceptance criteria:

- First unique map ships with a distinct look, fish pool, named spots, and mechanic.
- Map selection/travel makes the map identity clear.
- Players can tell maps apart from screenshots alone.

## Phase 5: Deep Cast Signature Systems

Goal: Make depth the core identity of the game.

Features:

- Depth zones: shallow, dropoff, deep, abyss.
- Cast depth affected by lure, line, boat, and cast power.
- Boat sonar pulse reveals fish silhouettes briefly.
- Unknown contacts appear in deep water.
- Deep-water fish require specific depth and gear.
- Rare signal events:
  - Blue pulse: rare school.
  - Red pulse: dangerous monster.
  - Gold pulse: trophy opportunity.
  - Static pulse: unknown/legendary.

Implementation notes:

- Add a `DepthSystem` that can evaluate bobber/lure depth from position and gear.
- Add sonar UI as a minimal radial pulse overlay.
- Tie deep fish pools to depth requirements instead of only boat/deep-water boolean.

Acceptance criteria:

- Players can deliberately target deeper fish.
- Sonar reveals useful temporary information.
- Deep water feels mechanically different from shore fishing.

## Phase 6: Multiplayer Game Modes

Goal: Make other players matter beyond presence.

Features:

- 5-minute fishing derby.
- Biggest catch leaderboard per map.
- Shared fish schools that multiple players can use.
- Trophy dock showing recent catches.
- Co-op monster fish fights.
- Quick reactions/emotes.
- Public room per map or fishing spot.

Recommended first multiplayer mode:

### Lake Derby

- Starts every few minutes or can be manually joined.
- Tracks biggest fish by weight during a short window.
- Shows live leaderboard.
- Rewards coins, XP, or cosmetic titles.

Implementation notes:

- Start with client-visible realtime state in Supabase.
- Avoid authoritative anti-cheat work until gameplay is stable.
- Use event IDs and timestamps for derby entries.

Acceptance criteria:

- Two players can join the same derby and see live rankings.
- Catch feed and leaderboard update without reload.
- Derby has a clear start/end/reward flow.

## Recommended Build Order

1. Online players HUD and catch feed.
2. Better reeling/fish fight.
3. Fish shadows and lure chase.
4. First unique map: Mistfall Reservoir.
5. Depth zones and sonar.
6. Multiplayer derby.
7. More unique maps.
8. Co-op monster fish.

This order improves the first-session experience quickly, then deepens the core loop before adding larger world and multiplayer systems.

## Near-Term Engineering Tasks

1. Add `MultiplayerUI`.
2. Extend presence payload with activity and last catch.
3. Add fight model for tension, stamina, progress, and line break.
4. Refactor reeling UI to show the new fight meters.
5. Promote ambient fish into visible bite candidates.
6. Add map identity data for named spots and unique mechanics.
7. Build Mistfall Reservoir as the first fully unique map.
8. Add depth/sonar primitives.
9. Add derby realtime table/channel.

## Open Product Questions

- Should the game be cozy-first, competitive-first, or weird/deep-sea-first?
- Should fish be mostly realistic, fantasy, or a mix?
- Should multiplayer be public rooms only, or support private invite rooms?
- Should progression favor gear upgrades, map unlocks, cosmetics, or collection completion?
- Should monster fish be solo endgame, co-op events, or both?
