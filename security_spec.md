# Risk Up Firestore Security Specification

## 1. Data Invariants
1. **PII Isolation**: Captain phone numbers (`phone`) and InstaPay transfer references (`ref`) MUST NEVER be stored in `/teams/{teamId}`. They are stored exclusively in `/team_contacts/{teamId}` and readable only by the team's `ownerUid` or an authorized admin.
2. **Atomic Team + Contact Creation**: Creating `/teams/{teamId}` MUST occur atomically with `/team_contacts/{teamId}` (`existsAfter` / `getAfter` guarantee), ensuring no orphaned team exists without captain contact info and `ownerUid` matches `request.auth.uid` on both.
3. **Payment Integrity**: Captains cannot self-mark a team as paid (`paid: false` enforced on create; only admins can update `paid`).
4. **Admin Authority**: Tournament schedule, scores (`/matches/{matchId}`), group reassignments (draw), payment confirmation, and team deletion are restricted strictly to verified admins (`youssefeslam906@gmail.com` with `email_verified == true` or `/admins/{uid}` documents created by the bootstrapped admin).
5. **Strict Bounds & Types**: Team names <= 30 chars, players list 5..8 strings, Egyptian phone `^01[0125][0-9]{8}$`, scores integer `0..99` or `null`, timestamps enforced via `request.time`.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated write to `/teams/t1` -> DENIED (`request.auth == null`).
2. Unverified email user creating `/teams/t1` -> DENIED (`email_verified != true`).
3. Captain creating `/teams/t1` with `paid: true` -> DENIED (`paid == false` required).
4. Captain spoofing `ownerUid: "other_uid"` -> DENIED (`ownerUid == request.auth.uid` required).
5. Shadow field injection `isVerified: true` on `/teams/t1` -> DENIED (`hasOnly` check).
6. Creating `/teams/t1` without atomic `/team_contacts/t1` -> DENIED (`existsAfter` check).
7. Non-admin reading `/team_contacts/t2` owned by another user -> DENIED (`ownerUid` / `isAdmin` gate).
8. Non-admin updating `/teams/t1` to change `paid` or `group` -> DENIED (`isAdmin` required).
9. Non-admin writing `/matches/A_t1_t2` -> DENIED (`isAdmin` required).
10. Admin writing `/matches/A_t1_t2` with `hs: 500` or string `"3"` -> DENIED (`0..99` integer validation).
11. Resource poisoning: document ID with >128 chars or invalid chars `../bad` -> DENIED (`isValidId` regex).
12. Email spoofing: user token with `email: "youssefeslam906@gmail.com"` and `email_verified: false` -> DENIED (`email_verified == true` required).
