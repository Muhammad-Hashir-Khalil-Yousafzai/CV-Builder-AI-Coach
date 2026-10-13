# CV Portal — Backend (Django + DRF)

## Setup
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edit SECRET_KEY etc.
python manage.py migrate
python manage.py createsuperuser   # first admin, or POST /api/auth/signup/ then promote via Django admin
python manage.py runserver
```

## Auth endpoints
| Method | URL | Who | Purpose |
|---|---|---|---|
| GET  | /api/auth/check-email/?email=... | anyone | live "is this email taken?" for the signup form |
| POST | /api/auth/signup/ | anyone | create account, returns JWT access+refresh |
| POST | /api/auth/login/  | anyone | email+password -> JWT access+refresh+user |
| POST | /api/auth/refresh/ | anyone (with refresh token) | rotate access token |
| POST | /api/auth/logout/ | logged-in | blacklists the refresh token |
| GET/PATCH | /api/auth/me/ | logged-in | own account (name, etc.) |

## CV / profile endpoints
| Method | URL | Purpose |
|---|---|---|
| GET/PATCH | /api/profile/me/ | full CV (all nested sections) for the logged-in user |
| CRUD | /api/profile/education/, /experience/, /skills/, /projects/, /certifications/ | each section managed independently, always scoped to the logged-in user |

## Admin-only endpoints (role == "admin")
| Method | URL | Purpose |
|---|---|---|
| GET | /api/admin/users/ | list every registered user (email, role, date_joined, last_login, last_login_ip) — filter with ?role=&is_active=, search with ?search= |
| POST | /api/admin/admins/ | create another admin account |
| GET | /api/admin/users/<id>/profile/ | view any one user's CV |

## Validation — client-side vs server-side, and what can go wrong
- **Client-side** (`/api/auth/check-email/`): the signup form calls this on blur/debounce to tell the user instantly "that email is taken" without a full page submit. It's UX only — it never blocks anything by itself, and it's rate-limited + returns only a boolean (no user details) to resist account-enumeration scraping.
- **Server-side** is what's actually authoritative, in three layers:
  1. `SignupSerializer.validate_email` re-checks uniqueness at submit time.
  2. The DB column itself has `unique=True` — this is the real guarantee.
  3. `SignupView.create` catches `IntegrityError` as a last-resort net.
- **Why three layers?** Between the moment the browser confirms "email free" and the moment the signup POST lands, another request for the *same* email can land first (two browser tabs, a second device, or two people racing a popular username) — a classic TOCTOU race condition. Without the DB-level unique constraint + IntegrityError catch, that race can either create two accounts with the same email or crash with an ugly 500. With them, the second request always gets a clean 400.
- Passwords go through Django's built-in validators (min length 8, not too similar to the user's name/email, not a common password, not all-numeric) — both signup and admin-creates-admin use the same check.
- Login/signup/check-email are all throttled (`ScopedRateThrottle`) to slow down brute-force and enumeration attempts.

## Role model
`User.role` is `"user"` or `"admin"`. Any admin can promote-by-creating another admin via `POST /api/admin/admins/`. `role == "admin"` also sets `is_staff = True` automatically so the same account can log into `/admin/` (Django's built-in admin site) if needed — that's a separate, optional surface from our API.
