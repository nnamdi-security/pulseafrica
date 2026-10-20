# 0024. Sign-in, register and the session in the new frontend

- **Status:** Accepted (2026-10-20)
- **Deciders:** Nnamdi (project owner)
- **Related:** roadmap decisions D41, D43–D46, [decision 0011](0011-cookie-session-and-csrf.md), [decision 0022](0022-poll-page-sign-in-and-radios.md), [SEC-04](../AUDIT.md#sec-04), Milestone 7

## Context

Milestone 7 moves Login, Register and the Dashboard into `frontend/`, signed in only by the API's HttpOnly `pa_session` cookie. That cookie has `Path=/api` (decision 0011), so the Next.js server never receives it: a server-side redirect can't tell who is signed in.

## Decision

- **D41, protected pages:** `/dashboard*` is guarded in the browser. `useMe()` decides; the page shows its loading state, then its content or a signed-out notice with Sign in and Create account links, as `dashboard.html` does. There is no `proxy.ts` (Next.js middleware). The API stays the only authority: every request it refuses with 401 returns the page to its signed-out state.
- **D43, routes:** `/login`, `/register` and `/login/reset`; `/dashboard`, `/dashboard/history` and `/dashboard/settings` (FRONTEND_MIGRATION §7). The sign-in and create-account tabs are links between the two routes.
- **D44, landing after sign-in:** a safe `next` (an internal path, or an old page name mapped to its new route) is followed; without one, the success panel shows, as on `login.html`.
- **D45, "Keep me signed in":** as decision 0011 specifies. Ticked, the cookie lasts as long as the token (60 minutes) and survives a browser restart; unticked, it ends with the browser session. Longer sessions, if wanted, belong with deployment (M9).
- **D46, after a password change (revised and confirmed by the owner 2026-10-20):** the API ends every session, this one included (decision 0010). The page then signs this browser straight back in with the new password, for the browser session only (as if "Keep me signed in" were unticked, since the page can't read the cookie's lifetime), and says "Your password has been changed." under "You'll stay signed in on this device.", as `dashboard.html` does. If that sign-in fails, the page shows that the session has ended. Every other device stays signed out.
  - *Correction:* the first version of this record said `dashboard.html` reported "changed" and then failed the next request, and chose to sign the user out. That premise was wrong: `api.js`'s `changePassword` already signs in again with the new password, keeping the remember choice it can read from Web Storage, so `dashboard.html` needs no fix.

## Alternatives considered

- **D41:** a non-secret `pa_signed_in` marker cookie on `Path=/` for `proxy.ts` to read (a second cookie that can drift from the real session), or `pa_session` on `Path=/` (sent with every page request, for no security gain).
- **D43:** one `/login` and one `/dashboard` with hash tabs, as today.
- **D44:** go straight to `/dashboard`.
- **D45:** remembered sessions of about 30 days (a backend and security change).
- **D46:** sign the user out and ask them to sign in again (the first version of this record, built on a wrong premise; it would differ from `dashboard.html`), or have the API issue this device a new cookie that keeps its lifetime (a contract change).

## Consequences

- No API change. The frontend rules' line about middleware redirects no longer applies to `frontend/`.
- `/dashboard` briefly shows its loading state before a signed-out visitor sees the notice, as `dashboard.html` does today.
- Old links keep working: `login.html#register` and `login.html?next=poll.html%3Fid%3D3` land on `/register` and on `/login?next=/polls/3`.
- SEC-04 is fixed in `frontend/`: no token is ever stored where JavaScript can read it.
