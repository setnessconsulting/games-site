# Number Line Jumper SDK host pilot

The arcade host adapter is opt-in and pins the Game Platform SDK to the same
immutable 0.1.1 revision as Number Line Jumper. It generates a per-frame
channel and session ID, limits `postMessage` to the arcade origin, negotiates
an embedded arcade launch, checks the expected game identity, and reports a
session completion only after that handshake.

The Number Line Jumper play route does not opt in on this branch. Keep it that
way until a versioned SDK-enabled static-web artifact is published to the
candidate asset path and its handshake, bundle delta, rollback, and acceptance
evidence are recorded. No production release pointer or R2 object is changed by
this integration.
