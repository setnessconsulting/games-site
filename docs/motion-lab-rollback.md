# Motion Lab rollback and pointer semantics

Status: established by GAME-385 / ML-HOST; promotion applied by GAME-401 / ML-PROMOTE
Game repository: `setnessconsulting/game-motion-lab`
Jira: GAME-382 (Epic), GAME-385 (ML-HOST), GAME-401 (ML-PROMOTE)

This document satisfies ML-HOST acceptance criterion 5: rollback and pointer semantics are
documented. It now also records what promotion actually changed and what the live rollback anchor
is, because there is finally a production pointer that a rollback would move.

> **No rollback has been performed for Motion Lab.** Nothing has been rolled back and no rehearsal
> has been run. What exists now is a named restore target and a documented procedure; that is a plan
> with an anchor, not evidence of a working rollback. Anyone claiming otherwise is claiming
> something nobody observed.
>
> **Live as of promotion:** production serves the catalog revision that selected
> `0.1.0-ml-host-evidence.1` (source SHA `f2b89866134e4b106bb17a74730d2e55ef7fdab8`). The last
> known-good deployment before it is `8091aea0-ec63-47b4-a3b3-c0844b31b134`, built from games-site
> commit `f162bd2`, reachable at `https://8091aea0.games-site-7pn.pages.dev`. Restoring it returns the
> collection to the coming-soon card; it does not touch the immutable R2 prefix.
> **Remaining gates:** no independent science review, accessibility sign-off, target-age playtest,
> real-device testing, comparator review, or rollback rehearsal was performed for the promoted
> version. The owner authorised promoting with those gates open.

---

## 1. The three things a rollback can move

| Thing                   | Where it lives                                      | Who changes it                                       |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Catalog release pointer | `src/data/games.ts` in this repository              | a reviewed catalog change, then a deploy of the site |
| Immutable artifact      | R2 under `motion-lab/<version>/`                    | the publisher; **never** mutated or deleted          |
| Deployment / alias      | the Cloudflare Pages deployment the alias points to | switching the production alias                       |

Rollback restores a **previous known-good catalog revision** and deploys it. It never deletes,
overwrites, or re-uploads an immutable R2 object. That rule is what makes the artifact identity in
the release manifest meaningful: if a version could be overwritten, "the exact version" would not
identify anything.

---

## 2. Pointer semantics while Motion Lab was unpromoted (historical)

This section describes the state that ended at promotion. It is kept because the invariants it
records — a pointer that cannot be read as production — are still enforced and still tested.

Motion Lab had no `release` and no `MOTION_LAB_PRODUCTION_VERSION`. There was therefore no
production pointer to move. The only pointer that could exist was `MOTION_LAB_PREVIEW_VERSION`, and
it is a **deployment variable**, not a committed value:

- **Different environments, one catalog.** The catalog entry is `coming-soon` everywhere. Nothing in
  the repository has to change to move a preview pointer, because the pointer does not live in the
  repository.
- **The pointer is the only thing that can approve a preview asset.** `isApprovedRelease` cannot
  approve Motion Lab through the catalog fallback, because the entry carries no `release` and is not
  `playable`. Clearing `MOTION_LAB_PREVIEW_VERSION` therefore revokes access to the candidate
  completely: the play route falls back to the shared unavailable panel and asset requests return 404.
- **Rolling back an unpromoted preview is a variable change plus a deploy**, not a catalog change.

That property is the preview's rollback story: the fastest way to withdraw an unqualified candidate
is to empty one variable, and it needs no catalog edit, no cache purge, and no artifact change.

---

## 3. Pointer semantics after promotion (current)

This is the state Motion Lab is in now. The catalog carries a committed production version, and — if
a further qualification pass is running — a deployment preview pointer. The same discipline applies
as for the six promoted games:

- the production pointer is a committed, reviewable catalog value;
- the preview pointer is a deployment variable and can never be read as production
  (`getReachablePlaySource` prefers a promoted release, and `getStaticWebPlaySource` is status-gated);
- a mistaken deployment variable cannot promote anything, because promotion is a merged catalog
  change and nothing else.

---

## 4. The rollback procedure (not yet rehearsed)

1. identify the last known-good **games-site commit** whose catalog pointer was correct;
2. create a Cloudflare Pages deployment from that commit, or switch the production alias to a
   deployment already built from it;
3. verify on both the Pages hostname and the custom domain that the collection card and the direct
   play route behave as intended;
4. if the candidate is being withdrawn, also clear the preview variable so the candidate is not
   reachable through the preview path;
5. record the deployment ids, the commit SHAs, the exact artifact prefix that was observed, and the
   HTTP status of the entry document and its assets;
6. restore forward only after the withdrawal is no longer needed.

Immutable R2 objects are left in place throughout. A withdrawn candidate stays published; it simply
stops being reachable.

---

## 5. What ML-PROMOTE must produce

A rollback is not exercised until it is executed against a real deployment and its result is
observed. For Motion Lab, ML-PROMOTE was to record:

- the deployment id and commit SHA used as the restore target;
- the exact artifact prefix observed before and after;
- the entry document and asset HTTP statuses, on both hostnames;
- confirmation that no immutable object was deleted or overwritten;
- the current pointer state, read back from the real site rather than from this document.

**None of that was produced, because no rollback was executed.** Only the restore target exists (see
the note at the top of this document and the deployment id above). The honest status of Motion Lab
rollback remains **not exercised**, and the procedure above is untested against a real deployment.
Recording a target is not the same as proving the route back to it works, and this document does not
claim otherwise.
