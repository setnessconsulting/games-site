# Motion Lab rollback and pointer semantics

Status: established by GAME-385 / ML-HOST
Game repository: `setnessconsulting/game-motion-lab`
Jira: GAME-382 (Epic), GAME-385 (ML-HOST), promotion and rollback owned by GAME-401 (ML-PROMOTE)

This document satisfies ML-HOST acceptance criterion 5: rollback and pointer semantics are
documented. It records the semantics that **will** apply, and states plainly that no rollback has
been exercised, because nothing has been promoted.

> **No rollback has been performed for Motion Lab.** Nothing is promoted, so there is no production
> pointer to roll back and no rehearsal to report. This is a documented plan, not evidence.

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

## 2. Pointer semantics while Motion Lab is unpromoted

Motion Lab has no `release` and no `MOTION_LAB_PRODUCTION_VERSION`. There is therefore no production
pointer to move. The only pointer that can exist is `MOTION_LAB_PREVIEW_VERSION`, and it is a
**deployment variable**, not a committed value:

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

## 3. Pointer semantics after promotion

Once ML-PROMOTE selects an immutable release, the catalog carries both a committed production
version and, if a further qualification pass is running, a deployment preview pointer. The same
discipline applies as for the six promoted games:

- the production pointer is a committed, reviewable catalog value;
- the preview pointer is a deployment variable and can never be read as production
  (`getReachablePlaySource` prefers a promoted release, and `getStaticWebPlaySource` is status-gated);
- a mistaken deployment variable cannot promote anything, because promotion is a merged catalog
  change and nothing else.

---

## 4. The rollback procedure (to be rehearsed at ML-PROMOTE)

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
observed. For Motion Lab, ML-PROMOTE must record:

- the deployment id and commit SHA used as the restore target;
- the exact artifact prefix observed before and after;
- the entry document and asset HTTP statuses, on both hostnames;
- confirmation that no immutable object was deleted or overwritten;
- the current pointer state, read back from the real site rather than from this document.

Until that exists, the honest status of Motion Lab rollback is **not exercised**.
