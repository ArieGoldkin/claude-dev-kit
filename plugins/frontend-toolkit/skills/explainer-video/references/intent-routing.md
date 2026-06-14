# Intent routing

Map a user's natural-language description to one of four composition patterns.

## Routing table

| User says... (signal phrases) | Pattern | Why |
|---|---|---|
| "show our X architecture" / "system diagram" / "components and connections" / "data flow through" / "service topology" / "what talks to what" | `architecture` | Focus is **structural** — nodes and edges, with motion mostly used to reveal/sequence the explanation, not to depict time progression |
| "walk through the X pipeline" / "explain phases" / "step-by-step process" / "the flow of N" / "how X works end-to-end" | `flow-pipeline` | Focus is **temporal** — phases unfold in order, time is the dominant axis |
| "show the sequence" / "actor X talks to actor Y" / "message flow over time" / "request goes from A to B to C" / "swimlane" | `sequence-diagram` | Focus is **per-actor temporal** — multiple parties exchanging messages with explicit time ordering |
| "state transitions" / "lifecycle" / "FSM" / "valid transitions" / "what happens when X moves to Y" | `state-machine` | Focus is **state-and-transition** — discrete states with a transition graph, often walked through scenario-by-scenario |

## Disambiguation rules

When the prompt contains signals for two patterns, prefer the more time-based one:

- `flow-pipeline` > `architecture` — if the user wants both the system shape AND the order of operations, the time axis dominates
- `sequence-diagram` > `state-machine` — if the user wants both the actors and the state changes, the message flow dominates
- `flow-pipeline` > `sequence-diagram` — when the actors collapse into "the system" vs distinct entities, prefer the simpler phase view
- `state-machine` > `architecture` — when the structure IS a state graph (not a service topology), the FSM pattern fits better

## Handling ambiguity

If the routing rules don't resolve uniquely, ask exactly ONE clarifying question. Pick the question that splits the highest-leverage axis:

- Structural vs temporal? → "Is this primarily about WHAT connects to WHAT, or about WHEN things happen?"
- Phases vs actors? → "Are you walking through phases of one process, or showing actors exchanging messages?"
- Transitions vs flow? → "Is the focus on transitions between defined states, or on message flow between actors?"

Do not ask more than one question per turn.

## Anti-pattern: pattern fusion

Resist combining patterns into a single composition. If the user wants "an architecture diagram that ALSO shows messages flowing AND state transitions per service," produce **multiple separate videos** and concatenate them at the publish step rather than one mega-composition. Each pattern's React template is optimized for its single concern; fusing them produces visually muddy results and triples the spec complexity.

When the user genuinely needs a multi-pattern story, the right move is:

1. Render the architecture video.
2. Render the per-actor sequence video.
3. Render the state-machine video.
4. Concatenate via FFmpeg in the publish step (or leave as three separate clips with a small index page).

## Edge cases

- **"Just animate this diagram"** — if the user already has a static diagram (PNG, SVG), this skill is the wrong tool. Recommend the official Remotion skill's image-import patterns instead.
- **"Make a tutorial video"** — out of scope for v1 (deferred to v2 as `onboarding`). For now, decompose into a flow-pipeline (the user's task steps) plus narration.
- **"Show the bug timeline"** — out of scope for v1 (deferred to v2 as `incident-replay`). For now, render as `flow-pipeline` with each phase being an event.
- **"Compare option A vs option B"** — out of scope for v1 (deferred to v2 as `comparison`). For now, render two separate flow-pipelines and place side-by-side in the publish step.

When v2 patterns become available, this routing table will gain more rows. Until then, route to v1 patterns or decline politely.
