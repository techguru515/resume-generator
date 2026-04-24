# 🚀 CV Builder – MERN Stack Application

A full-stack CV management platform built with the **MERN stack** that allows users to create, manage, and track job applications with profile-based CV generation, admin approval workflow, and export to **PDF/DOCX**.

---

## ✨ Features

### 👤 Client Features

* 🔐 JWT authentication (login/register)
* ⛔ Access gated until admin approval
* 👥 Multiple profiles per user (contact, education, certifications)
* 🧠 Draft CVs with OpenAI from the job description (server `OPENAI_API_KEY`)
* 📝 Create CV with profile selection
* 👀 Live CV preview (fully merged with profile data)
* 📥 Download CV as **PDF** and **DOCX**
* 📊 Dashboard grouped by profile with pagination
* 🔗 Store and view job links
* 🧭 Track application status:

  * Saved / Applied / Interview / Offer / Rejected
* 🧩 Drag & drop Kanban board (Progress page)

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

👉 http://127.0.0.1:3000

---

## 🔐 Authentication Flow

1. User registers → `role: client`
2. Admin must approve user
3. Only approved users can:

   * Create CV
   * Download files
   * Use dashboard

---

## 📄 CV Generation Flow

1. User selects a profile
2. Pastes unstructured job text and runs **Generate draft** (`OPENAI_API_KEY` on the server)
3. Backend calls OpenAI **twice**: (1) normalize the posting into structured job fields, (2) generate CV JSON from that structure plus the profile
4. Preview is generated
5. Save CV → stored in MongoDB
6. Download:

   * DOCX → `docx` library
   * PDF → Puppeteer

---

## 📊 Application Tracking

Each CV has:

```
application_status:
- saved
- applied
- interview
- offer
- rejected
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

* Browser downloads cannot control folder location (security limitation)
* For folder-based downloads → use ZIP generation on backend

---

## 👨‍💻 Author

Built as a **production-ready full-stack project** demonstrating:

* System design
* MLOps-ready architecture mindset
* Scalable frontend/backend separation

---

## 📄 License

wong && lspli
