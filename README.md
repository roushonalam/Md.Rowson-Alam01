# EduGenius AI — Next-Gen Bilingual AI Learning Platform

**Client:** Apex Edutech Labs Inc.  
**Audience:** Class 9–12, SSC/HSC, University students, admission candidates, job seekers, and educators (Bengali & English).

---

## Overview

EduGenius AI is a full-stack bilingual (Bengali + English) educational platform powered by the official `@google/genai` SDK on a hardened Node.js + Express backend and a responsive React + TypeScript + Tailwind CSS frontend. Every AI request is routed strictly through server-side API endpoints with Zod request/response validation, server-side quiz answer protection, and structured bilingual error handling.

---

## Features

1. **Landing Page (`/`)**
   - Bilingual hero with an interactive **"Ask AI"** prompt that routes directly to the Live Tutor and auto-sends the student's question.
   - Direct navigation to **Instant Concept Explainer**, **Smart AI Quiz Generator**, and **24/7 Personal AI Tutor**.
   - Clearly labeled **Demo figures** section.

2. **AI Study Hub (`/study-hub`)**
   - Subject (`Science`, `Mathematics`, `English`, `General Knowledge`, `Programming`), Level (`Beginner`, `SSC`, `HSC`, `University`, `Job Preparation`), Style (`Short Summary`, `Detailed Explanation`, `Flashcard Points`), and Output Language (`Bengali`, `English`, `Both`).
   - Structured JSON generation rendered into dedicated cards: Simple Explanation, Concept Definition, Real-world Analogy, Practical Examples, Important Points, and Summary.
   - Interactive 3D flip flashcards when **Flashcard Points** is selected.
   - LaTeX math rendering via KaTeX, Copy to Clipboard, and `.md` / `.txt` export.

3. **Smart Quiz Generator (`/quiz`)**
   - Generates 5 or 10 MCQs by Subject, Chapter/Topic, and Difficulty (`Easy`, `Medium`, `Hard`).
   - **Zero Answer Leakage:** Correct answers and explanations are stored exclusively on the server per `quizId` and are never sent to the browser before submission.
   - Step-by-step question flow with progress bar, live score, accessible icon + text feedback, detailed explanations, question-by-question review, **Retry Quiz**, and **New Quiz**.

4. **Live AI Tutor (`/tutor`)**
   - Real-time SSE streaming chat in Bengali and English using a dedicated pedagogical system instruction.
   - Built-in **Weekly Study Routine** planner (`POST /api/study-plan`) rendering structured 7-day study schedules inside chat.
   - Client-side `localStorage` chat history persistence (text only, never keys), quick prompts, accessible clear-chat confirmation modal, and error retry bubbles.

5. **Settings & Connection (`/settings`)**
   - Real-time backend health status (`Connected` / `Not configured` / `Error`).
   - Live model dropdown populated from `ai.models.list()` filtered to models supporting `generateContent`.
   - Temperature slider (`0.2`–`0.7`, default `0.4`) and **Test API Connection** verification.
   - Optional **Bring Your Own Session Key** held strictly in server RAM for the active session (never persisted to `localStorage`, `sessionStorage`, logs, or disk).

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide Icons, Motion, `react-markdown`, `remark-math`, `rehype-katex`
- **Backend:** Node.js, Express, TypeScript (`tsx` in dev, native Node 22+ TS execution in prod)
- **AI & Validation:** `@google/genai`, `zod`
- **Security:** `helmet`, `cors` allow-list, `express-rate-limit`, `dotenv`
- **Fonts:** `Plus Jakarta Sans`, `Inter`, `Noto Sans Bengali`, `JetBrains Mono`

---

## Project Structure

```text
/
├── client/
│   ├── components/       # Logo, Navbar, Footer, MarkdownMath, Skeletons, Toast, ErrorCard
│   ├── hooks/            # useSettings context & state
│   ├── lib/              # Typed API client (SSE + REST) & non-secret localStorage helpers
│   ├── pages/            # Landing, StudyHub, SmartQuiz, TutorChat, Settings
│   ├── types/            # Client TypeScript types
│   ├── App.tsx
│   ├── index.css         # Tailwind v4 @theme palette & KaTeX prose styles
│   └── main.tsx
├── server/
│   ├── middleware/       # Helmet, CORS allow-list, rate limiters
│   ├── routes/           # Express API router (/api/*)
│   ├── schemas/          # Zod schemas for requests & AI JSON outputs
│   └── services/
│       ├── ai/           # Reusable Gemini AI service (explain, quiz, tutor, study-plan)
│       └── sessionKeys.ts# Server-RAM-only optional session key store
├── shared/
│   └── types.ts          # Shared TypeScript interfaces
├── server.ts             # Express entry point + Vite dev middleware / prod static serving
├── .env.example
├── .gitignore
├── index.html
└── package.json
```

---

## Setup & Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:3000`.

4. **Type-check and build for production**
   ```bash
   npm run lint
   npm run build
   npm start
   ```

---

## Environment Variables

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Yes (or session key) | — | Server-side Google Gemini API key. Never expose to client. |
| `GEMINI_DEFAULT_MODEL` | No | `gemini-4-hydrogen` | Default Gemini model supporting `generateContent`. |
| `ALLOWED_ORIGINS` | Recommended (prod) | `http://localhost:3000` | Comma-separated allowed CORS origins. |
| `APP_URL` | Recommended (prod) | `http://localhost:3000` | Public URL of the hosted service. |
| `PORT` | No | `3000` | HTTP server port. |

---

## NPM Scripts

- `npm run dev` — Starts Express + Vite dev middleware on port `3000` via `tsx server.ts`.
- `npm run build` — Compiles the Vite client bundle into `dist/`.
- `npm start` — Runs the production Express server (`node server.ts`, serving `dist/` and `/api/*`).
- `npm run lint` — Runs TypeScript type checking (`tsc --noEmit`).
- `npm run clean` — Removes `dist/` build artifacts.

---

## API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns backend connection state (`connected` / `not_configured`), key presence booleans, and default model. |
| `GET` | `/api/models` | Calls Gemini SDK `models.list()`, filters to `generateContent`-capable text models, and returns sorted list. |
| `POST` | `/api/test-connection` | Executes a minimal `generateContent` call and returns latency + sample reply. |
| `POST` | `/api/session-key` | Stores an optional user-supplied API key in server RAM for the current session and returns an opaque session token. |
| `DELETE` | `/api/session-key` | Clears the temporary session key from server RAM. |
| `POST` | `/api/explain` | Generates Zod-validated structured study notes or flashcards (`responseSchema`). |
| `POST` | `/api/quiz/generate` | Generates 5 or 10 MCQs, stores answers server-side by `quizId`, and returns questions without answers. |
| `POST` | `/api/quiz/check` | Validates `{ quizId, questionId, selectedOption }` against server-stored answers and returns correctness + explanation. |
| `POST` | `/api/tutor/chat` | Streams bilingual AI Tutor responses over SSE (`stream: true`) or JSON (`stream: false`) with trimmed history. |
| `POST` | `/api/study-plan` | Generates a Zod-validated 7-day weekly study routine. |

---

## Security Notes

- **Server-Only SDK Calls:** `@google/genai` is imported and executed exclusively in `/server`. Never bundled into `/client`.
- **No Browser Key Storage:** API keys are never written to `localStorage`, `sessionStorage`, or client code. Optional session keys are sent over HTTPS to `/api/session-key`, stored only in an expiring in-memory `Map` on the server, and referenced by an opaque UUID token kept only in React memory.
- **No Quiz Answer Leakage:** `correctOption` and `explanation` are stripped from `/api/quiz/generate` responses and validated on `POST /api/quiz/check`.
- **Input & Output Hardening:** Zod schemas validate every request body and every structured AI JSON response (with up to 2 automatic retries on invalid JSON). Express uses `helmet`, a strict `cors` allow-list, `64kb` body limits, and `express-rate-limit`.

---

## Deployment

### Client Deployment (Vercel / Netlify)
If deploying the static frontend separately on **Vercel** or **Netlify**:
1. Build command: `npm run build`, output directory: `dist`.
2. Configure rewrites/proxy rules so `/api/*` forwards to your backend server URL, or host full-stack directly on Cloud Run / Render / Railway.
3. Never set `GEMINI_API_KEY` as a `VITE_*` variable.

### Server Deployment (Cloud Run / Render / Railway)
1. Deploy the repository to **Google Cloud Run**, **Render**, or **Railway**.
2. Build command: `npm install && npm run build`.
3. Start command: `npm start` (`NODE_ENV=production` + `node server.ts`).
4. Set `GEMINI_API_KEY`, `GEMINI_DEFAULT_MODEL`, `ALLOWED_ORIGINS`, and `APP_URL` strictly as **platform environment secrets** (never commit `.env`).

---

## Troubleshooting

- **`Not configured` badge in Settings:** Ensure `GEMINI_API_KEY` is set in your server environment (or Secret Manager) and restart the server, or provide a temporary session key in Settings.
- **`RATE_LIMITED` (429):** The Gemini API quota was temporarily exceeded. Wait for the countdown shown in the error card before retrying.
- **`MODEL_NOT_FOUND` (404):** Open **Settings**, refresh the live model list, and choose an active model returned by `models.list()`.
- **Quiz session expired:** In-memory quiz sessions expire after 2 hours or on server restart. Click **New Quiz** to generate a fresh set.
