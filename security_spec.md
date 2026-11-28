# Toolivo Firestore Security Specification

## Data Invariants
1. **User Profile Ownership & Role Immutability**: A user may only read or modify their own `users/{userId}` document. Regular users can only initialize with `role: "user"`, `plan: "free"`, and `credits: 0`, and cannot self-escalate `role`, `plan`, or `credits`.
2. **Admin Isolation**: Only verified admins (`admins/{uid}` or verified bootstrap admin `workwithamatya@gmail.com`) may modify `sponsorSlots`, `platformConfig`, `admins`, or approve/reject `adCampaigns`.
3. **PII Separation**: Public sponsor inventory (`sponsorSlots`) never stores `contactEmail` or advertiser PII. Private booking records (`adCampaigns`) and contact submissions (`contactMessages`) are accessible only to the submitting user and verified admins.
4. **Usage Log Integrity**: A `usageLogs/{logId}` entry must belong to `request.auth.uid`, match allowed tool categories, obey string length bounds, and use server timestamp `request.time`.
5. **Ad Campaign Workflow & Terminal State Locking**: New `adCampaigns` must start in `status: "pending_review"` or `"pending_payment"`, with `impressions: 0`, `clicks: 0`, valid `https://` destination URL, and server timestamps. Once a campaign reaches terminal state (`rejected` or `expired`), non-admins cannot modify it.

## Dirty Dozen Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Privilege Escalation on Create (`users/{uid}`)**: `{ uid: attacker, email: "a@b.com", displayName: "A", role: "admin", plan: "business", billingCycle: "annual", credits: 99999, createdAt: NOW, updatedAt: NOW }`
2. **Shadow Field Injection (`users/{uid}`)**: Valid user update plus `{ isVerified: true }`.
3. **Cross-User PII Read (`users/{victimUid}`)**: Authenticated non-admin attempting `get` or `list` on another user's profile.
4. **Unverified Admin Email Spoof (`platformConfig/global`)**: Token with `email: "workwithamatya@gmail.com"` and `email_verified: false` writing pricing config.
5. **Direct Sponsor Slot Hijack (`sponsorSlots/slot-1`)**: Non-admin attempting to set `status: "occupied"` and `destinationUrl: "https://evil.test"`.
6. **Ad Campaign Auto-Approval (`adCampaigns/{id}`)**: Advertiser creating a campaign with `status: "approved"` directly.
7. **Ad Campaign Impression/Click Spoofing (`adCampaigns/{id}`)**: Advertiser updating `impressions: 100000` or `clicks: 5000`.
8. **XSS URL Scheme Injection (`adCampaigns/{id}`)**: Advertiser submitting `destinationUrl: "javascript:alert(1)"`.
9. **Terminal Campaign Mutation (`adCampaigns/{id}`)**: Advertiser editing a campaign whose `status` is `"rejected"` or `"expired"`.
10. **ID Poisoning (`usageLogs/{1500_char_id}`)**: Oversized or invalid-character document ID.
11. **Backdated Timestamp Forgery (`usageLogs/{id}`)**: Client-supplied timestamp instead of `request.time`.
12. **Blanket List Scraping (`adCampaigns` / `contactMessages` / `usageLogs`)**: Unfiltered list query by a non-admin attempting to read other users' records.
