# Story craft and script revision workflow

## What changed

The original pilot rewrite is available in [the reading copy](story/pilot-the-eight-beat-failure.md), sourced from `server/pilotStory.ts`. Fresh projects receive an unapproved script draft with derived word count and reading-time estimates, no invented recording duration and no asserted human reviewer. Existing SQLite projects are not silently rewritten.

The Script Editor now shows craft questions against the live draft. CLI `episode check` exposes the same advisory through `storyCraft` and explicitly does not certify production readiness. Missing-field checks, word counts, similarity and keyword checks cannot establish whether a story is excellent, factual, original or emotionally effective.

No-key outline assistance uses the actual title, logline, cast and setting to produce a nine-beat **editorial scaffold**, not a completed bespoke screenplay. It is deterministic local guidance, not an AI provider call. It requires bounded nonempty inputs. Canon notes remain user-supplied planning context, not verified facts or instructions with higher authority. Configured paid calls remain disabled.

## Creative revision contract

1. **Hook with a contradiction.** Let the audience see evidence the apparent authority cannot explain. Avoid prologue exposition and generic alarms.
2. **Give the lead a debt.** Rhea's signed promise and incomplete attention to Kabir matter because the present task makes them costly, not because narration calls her flawed.
3. **Make opposition reasonable.** Mara protects informed choice and the workers' agency. Neither character needs to become incompetent for the other to be right.
4. **Escalate causally.** An attempted fix exposes a constraint; a limited test changes the model; a discovery forces a worse decision. Do not pile unrelated dangers onto a scene.
5. **Keep knowledge bounded.** Distinguish observation, inference and proof. The northern connection suggests a mechanism; it does not establish a villain, infection vector or coordinated Still strategy.
6. **Pay for the solution.** Plant tools, routes and skills before use. Save people without rescuing every resource, route and relationship as well.
7. **Put conflict inside work.** Let dialogue alter who acts, what is risked and whose consent is sought. Remove speech that merely repeats the narration.
8. **Let consequences breathe.** The lost photograph and incomplete map make the rescue's cost legible without a victory monologue.
9. **Close one question, open another.** Both mechanics escape. A copied connection and the opened bypass make the new pulse a consequence to investigate rather than a random cliffhanger.

## Editorial passes before approval

- **Causality:** write a one-line “because / therefore / but” chain for every scene. Remove scenes that change neither knowledge, risk nor trust.
- **Geography:** independently sketch the hatch, platform, mezzanine, bridge and bypass. Resolve every movement and deadline inconsistency before storyboarding.
- **Human voice:** read dialogue aloud. Check distinct intentions and subtext; shorten explanations whose evidence can be shown.
- **Continuity:** verify each character's information, injuries, resources, relationships and promises against the ledger. Do not convert uncertainty into canon by repetition.
- **Factual review:** obtain evidence for real hydraulic/medical claims. This fictional rescue is not operational or medical advice.
- **Pacing:** the current pilot is 1,581 spoken words, estimated 10:54 at 145 WPM. A 15-minute target needs meaningful scene development and a performed timing pass, not silence or padding. Beat times are calculated reading estimates, not voice alignment.
- **Distinctness and originality:** compare premises, consequences, imagery and dialogue across the season. Lexical similarity alone neither proves copying nor proves originality.
- **Independent review:** readers should explain the protagonist's choice, the rejected alternative and the ending's causal link without author explanation. Record their unresolved questions before revision.

A local review marker is not authenticated independent approval, rights clearance, technical QC, spend permission or publication permission. A durable review-event service remains pending. Do not upgrade historical status flags into evidence.

## Adopting the new draft safely

Read the new script first. For an existing project, open the current episode in the Script Editor, preserve the previous version, paste/adapt the reviewed text and save a new version using the current revision. Resolve any conflict rather than overwriting another draft. Review the card's premise/continuity fields as well; do not assume a narration-only paste updates them. Do not delete a database or modify JSON/SQLite internals to force reseeding.

`npm run studio -- episode check S01E001 --json` can inspect the current draft. It does not apply this repository rewrite or authorize rendering/publication.
