# Security Specification for Shared Playlists

## Data Invariants
1. A **SharedPlaylist** must have a unique name (1-100 chars), an immutable `ownerId` matching the creator, and an `ownerEmail`.
2. Access to **PlaylistItem** and **Comment** is strictly derived from the parent **SharedPlaylist**'s `ownerId` or `collaborators` list.
3. Every write (create/update) must include `updatedAt` set to `request.time`.
4. Users cannot modify `authorId` or `userId` fields to spoof identity.
5. `collaborators` array is limited to 20 emails to prevent resource exhaustion.

## The Dirty Dozen Payloads (Rejection Targets)

1. **Identity Spoofing**: Create a playlist with someone else's UID.
2. **Privilege Escalation**: Update a playlist you don't own to add yourself as a collaborator.
3. **Ghost Field Injection**: Add a `isVerified: true` field to a playlist item.
4. **ID Poisoning**: Use a 2KB string as a playlist document ID.
5. **Orphaned Writes**: Create an item in a non-existent playlist.
6. **Immutable Violation**: Change the `ownerId` of a playlist after creation.
7. **Type Poisoning**: Send a number for the `name` field of a playlist.
8. **Size Attack**: Post a comment with 500KB of text.
9. **Timestamp Spoofing**: Send a client-side timestamp instead of `request.time`.
10. **Unverified Access**: Read a private playlist without being the owner or in the collaborator list.
11. **Shadow Member Removal**: Try to delete the owner from the `collaborators` list (if they were there).
12. **Query Scraping**: List all playlists in the system without an ownership filter.

## Test Runner (firestore.rules.test.ts)

```typescript
// Skeleton for the test runner. 
// Actual tests would use @firebase/rules-unit-testing
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

// Test 1: Identity Spoofing
it('should deny creating a playlist with wrong ownerId', async () => {
    const db = getAuthedFirestore({ uid: 'userA' });
    const playlist = db.collection('shared_playlists').doc('p1');
    await assertFails(playlist.set({
        name: 'My Team',
        ownerId: 'userB', // Malicious
        ownerEmail: 'userA@example.com',
        collaborators: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }));
});

// Test 2: Size Attack
it('should deny huge comments', async () => {
    const db = getAuthedFirestore({ uid: 'userA' });
    const comment = db.collection('shared_playlists').doc('p1').collection('items').doc('i1').collection('comments').doc('c1');
    await assertFails(comment.set({
        text: 'a'.repeat(10001), // Max 10,000
        userId: 'userA',
        userName: 'User A',
        timestamp: serverTimestamp()
    }));
});
```
