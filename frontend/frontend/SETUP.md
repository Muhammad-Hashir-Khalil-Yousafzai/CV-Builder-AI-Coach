# Connecting your React app to the Django CV Portal backend

## 1. Install what these files need
```bash
npm install axios react-router-dom react-hook-form zod @hookform/resolvers react-hot-toast
```
(Skip any you already have installed.)

## 2. Drop the files in
Copy everything under `src/` here into your project's `src/` folder, keeping the
folder structure: `api/`, `context/`, `routes/`, `pages/`.

## 3. Point it at your backend
```bash
cp .env.example .env
```
Edit `VITE_API_URL` if your Django server runs somewhere other than
`http://127.0.0.1:8000/api`.

## 4. Wire up App.jsx
Open `src/App.example.jsx` — it shows exactly what to add to your existing
`App.jsx`: wrap in `<AuthProvider>`, add the 5 routes, add `<Toaster />` once.
Don't just overwrite your file with it — merge the pieces in.

## 5. Tailwind
These pages use `.input`, `.err`, `.btn-primary` utility classes, defined in
`styles.css`. If you don't already have Tailwind set up:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
and add `content: ["./index.html", "./src/**/*.{js,jsx}"]` to `tailwind.config.js`.
If you're NOT using Tailwind, swap those three class names for your own CSS.

## 6. CORS — make sure ports match
The backend's `.env` has:
```
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```
5173 is Vite's default port. If your dev server runs on a different port,
add it there too, or the browser will block every request with a CORS error.

## 7. Run both
```bash
# terminal 1
cd backend && python manage.py runserver

# terminal 2
cd frontend && npm run dev
```
Go to `http://localhost:5173/signup`, create an account, and you should land
on `/dashboard` with your (empty) CV ready to fill in.

## What each file does
| File | Purpose |
|---|---|
| `api/axios.js` | Central HTTP client. Auto-attaches your JWT to every request, and if a request comes back 401 (expired access token), it silently uses the refresh token to get a new one and retries — you never have to think about token expiry in your components. |
| `context/AuthContext.jsx` | Holds the logged-in user + `signup`/`login`/`logout`/`checkEmail`. Wrap your app in this once. |
| `routes/ProtectedRoute.jsx` | Redirects to `/login` if nobody's logged in. |
| `routes/AdminRoute.jsx` | Redirects non-admins away from `/admin`. |
| `pages/Signup.jsx` | Client-side validation (zod) + live email-availability check on blur. Server errors (e.g. the race-condition case) surface as toast messages. |
| `pages/Login.jsx` | Straightforward email+password login. |
| `pages/Dashboard.jsx` | The editable CV — matches every field your backend's `CVProfile` model actually has (headline, summary, contact info, photo) plus the 5 repeatable sections (education, experience, skills, projects, certifications), each with its own add/save/remove hitting the matching endpoint. |
| `pages/AdminPanel.jsx` | Lists all users (search + role filter, debounced) and a form to create new admins — matches `PromoteAdminSerializer` exactly (email, password, first_name, last_name). |
