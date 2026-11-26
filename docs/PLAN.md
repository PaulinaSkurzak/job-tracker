# Job Tracker: architecture and schema plan

## Problem
Co-op applications open December to February. Applying to dozens of roles means tracking status, deadlines, contacts and follow-ups, and tailoring a resume to each posting. This app is one place for all of it.

## Architecture

```
browser --> nginx (:80) --> gunicorn + Django (:8000) --> PostgreSQL (:5432)
              |
              +--> serves /static/ files directly
```

| Piece | Why |
|---|---|
| Django | Gives auth, ORM, migrations, forms and admin for free, so I can focus on the data model and logic. |
| PostgreSQL | Real relational data (applications, contacts, history) and the database I will reuse in projects 2 and 3. |
| gunicorn | Django's dev server is not for production; gunicorn is the standard WSGI server. |
| nginx | Reverse proxy: serves static files fast, terminates the connection, and shields gunicorn. |
| Docker Compose | One command (`docker compose up`) starts all three services the same way on any machine. |
| HTMX + SortableJS | Drag-and-drop kanban without writing a separate React app. React comes in project 2. |

Config comes from a `.env` file (never committed). `.env.example` is committed.

## Data model

```
Company 1---* Application 1---* StatusChange
   |              *
   |              |
   *              * (many to many)
Contact 1---* Interaction
Resume (text used for keyword matching)
```

- **Company**: name, website, notes.
- **Application**: company, role title, location, job URL, job description (text), status, board position, term (e.g. Summer 2027), co-op length (4/6/8 months), date applied, deadline, match score, timestamps.
  - Status choices: Saved, Applied, Screen/OA, Interview, Offer, Rejected, Withdrawn.
- **StatusChange**: application, from status, to status, timestamp. Written whenever status changes. This is what makes the funnel stats possible (for example how many applications reach interview).
- **Contact**: name, company, role, email, LinkedIn URL, notes.
- **Interaction**: contact, date, kind (coffee chat, email, referral, other), notes, follow-up date.
- **Resume**: name, extracted text, active flag.

## Features, in build order
1. Scaffold: Django + Postgres + nginx running in Compose (hello page).
2. Models, migrations, admin.
3. Application CRUD and the kanban board (drag cards between status columns).
4. Contacts and interactions, with follow-up reminders on a dashboard.
5. Resume keyword match: tokenize the job description and resume, drop stopwords, score the share of important job-description keywords that appear in the resume, and list the missing ones.
6. Dashboard stats (applications per status, funnel), tests, GitHub Actions CI, README.

## Decisions I need from you
- Django templates + HTMX for the UI (recommended), or Django REST + separate React.
- Single user with login (recommended: it is your private tracker), or multi-user.
- Repo: its own GitHub repo `job-tracker` (recommended, so it can be pinned).

## Out of scope for now
Email integration, scraping job boards, browser extension. Maybe later.
