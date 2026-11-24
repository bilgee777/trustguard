# API reference

The API is served under `/api`. A machine-readable OpenAPI 3 document is available at **`/api/openapi.json`** on a running instance. All bodies are JSON. Enum values and property names match the TypeScript types in `web/src/features/analysis/engine/types.ts`.

## Authentication model

The web app signs in with **cookies**, not a token it handles itself:

| Cookie | Purpose | Flags |
|---|---|---|
| `tg_access` | 15-minute JWT | `HttpOnly`, `SameSite=Strict`, path `/api` |
| `tg_refresh` | 14-day opaque token, stored hashed | `HttpOnly`, `SameSite=Strict`, path `/api/auth` |
| `tg_csrf` | CSRF token | readable by JavaScript, `SameSite=Strict` |

A state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) that carries session cookies must send the CSRF cookie's value in an **`X-CSRF-Token`** header, and its `Origin` header (if present) must match the site. Call `GET /api/auth/csrf` once to obtain the cookie.

Non-browser clients can send the access token as `Authorization: Bearer <token>` instead; such requests carry no ambient credentials and need no CSRF header.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/csrf` | none | Issues the CSRF cookie and returns `{ csrfToken }`. |
| GET | `/api/auth/session` | none | `{ user, canRefresh }`. Always 200, so anonymous visitors never see a 401. |
| POST | `/api/auth/register` | none | `{ email, password, displayName }`. Creates the account and starts a session (201). |
| POST | `/api/auth/login` | none | `{ email, password }`. Starts a session. |
| POST | `/api/auth/refresh` | refresh cookie | Rotates the refresh token and issues a new access token. |
| POST | `/api/auth/logout` | none | Revokes the session family and clears cookies (204). |
| GET | `/api/auth/me` | required | The signed-in user and their settings. |
| POST | `/api/analyses` | optional | `{ contentType, text }`. Returns `{ result, saved, historyId }`. Saved only for a signed-in user whose history is on. |
| POST | `/api/url-inspections` | optional | `{ url }`. Structural report. The link is never fetched. |
| GET | `/api/history` | required | List with filters: `level` (repeatable), `from`, `to` (dates), `q`, `sort` (`newest`, `oldest`, `score`), `page`, `pageSize` (max 50). |
| GET | `/api/history/{id}` | required | One saved analysis with its masked text and full result, when stored. |
| DELETE | `/api/history/{id}` | required | Delete one analysis (204). |
| DELETE | `/api/history` | required | Delete all history. Returns `{ deleted }`. |
| GET | `/api/me/settings` | required | `{ historyMode, retentionDays }`. |
| PUT | `/api/me/settings` | required | Change history mode (`off`, `summary`, `redacted_text`) and retention (7, 30, 90 or 365 days). Stepping down from `redacted_text` deletes stored text. |
| DELETE | `/api/me` | required | `{ password }`. Deletes the account and everything under it (204). |
| GET | `/api/health/live` | none | Process is up. |
| GET | `/api/health/ready` | none | Database is reachable. |

`contentType` is one of `sms`, `email`, `whatsapp`, `job_offer`, `url`. Text is limited to 10,000 characters.

## Errors

Every error is `application/problem+json` with a stable machine-readable `code`:

```json
{
  "title": "Request blocked",
  "status": 403,
  "detail": "The CSRF token is missing or does not match. Reload the page and try again.",
  "code": "csrf_token_invalid",
  "traceId": "00-4b1f..."
}
```

Validation failures use status 400 with an `errors` object keyed by field. Unexpected failures return a generic 500 with only the trace id.

| Status | `code` | Meaning |
|---|---|---|
| 400 | `invalid_request`, `invalid_email`, `weak_password` | Malformed body or unacceptable input. |
| 401 | `no_session`, `invalid_session`, `session_expired`, `session_revoked`, `invalid_credentials` | Not signed in, or the session ended. `session_revoked` means a rotated refresh token was replayed. |
| 403 | `csrf_token_invalid`, `origin_not_allowed` | CSRF defenses rejected the request. |
| 409 | `email_taken`, `refresh_in_progress` | Conflict. `refresh_in_progress` means another tab just renewed the session: retry once. |
| 422 | `analysis_timeout` | A pattern exceeded its time budget. |
| 429 | `rate_limited`, `too_many_attempts` | Slow down. See the `Retry-After` header. |

## Rate limits

Per client address (per account for signed-in analysis requests):

| Scope | Default |
|---|---|
| Sign-in, sign-up, refresh | 10 per minute |
| Analysis, anonymous | 30 per minute |
| Analysis, signed in | 120 per minute |
| Everything | 600 per minute |

Five failed sign-ins lock an account for 15 minutes.

## Example

```bash
B=http://localhost:8080
curl -s -c jar -b jar $B/api/auth/csrf > /dev/null
TOKEN=$(awk '$6=="tg_csrf"{print $7}' jar)

curl -s -b jar -X POST $B/api/analyses \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $TOKEN" \
  -d '{"contentType":"sms","text":"URGENT: verify your account at http://paypa1-login.top"}'
```
