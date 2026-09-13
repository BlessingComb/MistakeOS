# MistakeOS minors and student-data review

Status: launch blocker for any audience that may include minors until the owner completes a jurisdiction-specific legal/product review. This document does not claim COPPA, FERPA, GDPR-K, LGPD or other compliance.

## Product facts requiring review

- The app may process student-created learning notes and optional photos of questions/attempts.
- It supports email/password accounts, private study groups, optional AI photo analysis and paid subscriptions.
- The current app has no age gate, parent/guardian flow, school agreement workflow, teacher/admin role, or age-based feature restriction.

## Required owner decisions before targeting minors

1. Define the minimum age and the countries/stores in scope. Do not market to children until counsel approves an age-appropriate flow.
2. Decide whether parental/guardian consent, school authorization, or verified educator agreements are required for each jurisdiction and distribution channel.
3. Minimize collection: avoid real names where not needed; prohibit student IDs, faces, grades, health information and personal contact details in photos/notes; keep photo analysis opt-in.
4. Define whether underage users can join groups, whether messaging/comments are allowed, moderation/reporting, invite controls, blocking and abuse response. Current private-group controls alone are not a safeguarding program.
5. Publish age-appropriate privacy disclosures, contact process, deletion/export workflow, vendor/subprocessor disclosure and retention terms.
6. Test account deletion, support escalation and incident response with minor/student records before launch.

## Engineering guardrails already present

- No client service-role credential; Supabase RLS scopes user data.
- Private mistakes/photos are not automatically copied into groups.
- AI photo analysis warns the learner to remove names, faces and personal data.
- Account deletion now has a server-side authenticated path and clears local learning data on that device.

## Open product safeguards

- Add an age/consent strategy only after legal decisions; do not fake verification.
- Add group moderation/reporting/blocking and an incident process before opening groups to minors or school cohorts.
- Review all screenshots, store copy, onboarding and support messages for student-data guidance in EN and pt-BR.
