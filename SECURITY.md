# Security policy

TrustGuard analyzes messages that people suspect are scams, so it handles sensitive text. Security and
privacy reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use GitHub's private reporting instead:
open the repository's **Security** tab and choose **Report a vulnerability**. Include what you found, how to
reproduce it and what you think the impact is.

## Supported versions

Only the latest commit on `main` is supported. This is a portfolio project, so there are no backported fixes.

## How the project approaches security

- **Privacy by default.** Analysis runs in the browser. A message reaches the server only when a signed-in user
  has turned history on, and personal data is masked before anything is stored.
- **Accounts.** Salted password hashes (PBKDF2), HttpOnly SameSite=Strict session cookies, short-lived access
  tokens, hashed refresh tokens with rotation and reuse detection, account lockout, and CSRF protection.
- **Untrusted input.** Every message is treated as hostile: no HTML injection path, bounded regular expressions
  with a timeout, size limits, and parameterized queries through EF Core.
- **Links are never fetched.** URLs are inspected as text only.
- **Supply chain.** Dependabot and CodeQL run on this repository, and CI fails on lint, type and test errors.

## Known trade-offs

- Registration reveals whether an email address is already registered. Hiding it needs email verification.
- An attacker who knows an email address can lock that account for 15 minutes with failed sign-ins. The
  alternative, no lockout, would allow unlimited password guessing.
- Look-alike and brand detection uses a small curated list and heuristics. A low risk score is never proof
  that a message is safe.
