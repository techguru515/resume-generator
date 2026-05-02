# 🚀 Resume Generator – MERN Stack Application

A full-stack CV management platform built with the **MERN stack** that lets users create, manage, and track job applications with profile-based CV generation, admin approval workflow, and export to **PDF/DOCX**.

---

## ✨ Features

### 👤 Client Features

* 🔐 JWT authentication (login/register)
* ⛔ Access gated until admin approval
* 👥 Multiple profiles per user (contact, education, certifications)
* 🧠 Generate CVs with OpenAI from job links + JD on **Workspace** (server `OPENAI_API_KEY`)
* 📝 Chrome extension / Workspace flow (save link → JD → generate)
* 👀 Live CV preview (fully merged with profile data)
* 📥 Download CV as **PDF** and **DOCX**
* 🎨 Resume templates (per profile, 3 options):

  * Classic
  * Executive (Two-column)
  * Executive (Color)
* 📊 Dashboard grouped by profile with pagination
* 🔗 Store and view job links
* 🧭 Track application status:

  * Saved / Applied / Interview / Offer / Failed
* 🧩 Drag & drop Kanban board (Progress page)
* ✅ Workspace link table status indicators:

  * JD button is **green** when JD exists, **red** when missing
  * Profile selector is **green** when profile is selected, **red** when missing

---

### 🛠️ Admin Features

* 📊 Dashboard with:

  * Total clients
  * Approval stats
  * CV count
  * Activity chart (Recharts)
* 👥 Client management:

  * Approve / Revoke users
  * View CV count per user
* 📄 CV management:

  * Search + filter by status
  * View all CVs across users
* 📌 Progress board:

  * Select client
  * Filter by profile
  * Drag & drop CV status

---

## 🧱 Tech Stack

### Backend

* Node.js + Express
* MongoDB + Mongoose
* JWT authentication
* bcryptjs (password hashing)
* Puppeteer (PDF generation)
* docx (DOCX generation)
* OpenAI API (draft CV content from job description + profile)
* Handlebars (DB-backed PDF templates)

### Frontend

* React 19 + Vite
* Tailwind CSS
* Axios (API client)
* React Router v7
* Recharts (analytics)
* @dnd-kit (drag & drop)

---

## 📁 Project Structure

```
CV_builder/
│
├── server/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   └── index.js
│
├── client/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/
│   │   └── api.js
│   └── vite.config.js
│
└── cv/                 # server-side saved copies of downloads (created automatically)
```

---

## ⚙️ Environment Variables

Create `server/.env`:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cv_generator
JWT_SECRET=your_super_secret_key

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure_password

# OpenAI — CV drafting (required): extract job facts, then generate CV JSON
OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
# OPENAI_MODEL_EXTRACT=gpt-4o-mini

# Optional: use a system Chrome/Chromium for PDF generation (Windows)
# PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

---

## 🚀 Getting Started

### 1. Clone repo

```bash
git clone <your-repo-url>
cd CV_builder
```

---

### 2. Install dependencies

#### Server

```bash
cd server
npm install
```

#### Client

```bash
cd ../client
npm install
```

---

### 3. Run the app

#### Start backend

```bash
cd server
node index.js
```

#### Start frontend

```bash
cd client
npm run dev
```

---

### 4. Open app

👉 `http://127.0.0.1:3000` (Vite may choose `3001` if `3000` is in use)

---

## 🔐 Authentication Flow

1. User registers → `role: client`
2. Admin must approve user
3. Only approved users can use Workspace generation, downloads, and the dashboard.

---

## 📄 CV Generation Flow

1. User saves job URLs on **Workspace** (or via the Chrome extension), assigns a profile, pastes JD text.
2. **Generate** calls the API; backend uses OpenAI **twice**: (1) normalize the posting, (2) produce CV JSON from that structure plus the profile.
3. CV is persisted in MongoDB and linked from the workspace row.
4. Download from CV detail / extension:

   * DOCX → `docx` library
   * PDF → Puppeteer + templates

---

## 📊 Application Tracking

Each CV has:

```
application_status:
- saved
- applied
- interview
- offer
- failed
```

---

## 🧩 Drag & Drop (Kanban)

* Built with `@dnd-kit`
* Optimistic UI updates
* Status changes persisted via API

---

## 🧠 Key Design Decisions

* Two-step OpenAI pipeline (extract structured job info from messy text, then write CV fields); no manual JSON in the UI
* ✅ Profile-based CV composition
* ✅ Admin-controlled access (approval flow)
* ✅ Separation of concerns (client/admin views)
* ✅ Optimistic updates for better UX
* ✅ Secure routes with middleware

---

## 🔥 Future Improvements

* Export multiple CVs as ZIP
* Email integration (apply directly)
* In-app editing of draft fields without re-calling the API
* Public CV share link
* Mobile optimization

---

## 🧪 Demo Credentials

```
Admin:
email: admin@example.com
password: secure_password
```

---

## 📌 Notes

* Browser downloads cannot control folder location (security limitation).
* When a user downloads a CV, the backend also saves a copy in the project root `cv/` folder.
* Downloaded filenames are based on the **profile name** (e.g. `John Doe.pdf`, `John Doe.docx`).

---

## 👨‍💻 Author

Built as a **production-ready full-stack project** demonstrating:

* System design
* MLOps-ready architecture mindset
* Scalable frontend/backend separation

---

## 📄 License

Skydev
