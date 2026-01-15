# Project Track Base 📦

**Project Track Base** is a modern enterprise web application designed to digitize logistics, inventory management, and reporting processes, powered by **Next.js 15** and **Artificial Intelligence**.

[🌐 **Live Demo:** https://trackbase.ahmetmersin.com](https://trackbase.ahmetmersin.com/)

## ✨ Features

### 📊 Dashboard & Reporting
![Dashboard Preview](/public/screenshots/dashboard-reports.png)
- **KPI Cards:** Instant tracking of key metrics like total stock, active companies, and critical items.
- **Dynamic Charts:** Sales and stock movement graphs filterable by time ranges.
- **Date Filtering:** Detailed reporting with customizable date ranges.

### 📦 Inventory Management
![Inventory List](/public/screenshots/inventory-list.png)
- **Detailed Stock Tracking:** Listing by material reference, company, and stock quantity.
- **Intuitive Search:** Automatically detects dates from searched waybill numbers or notes, finding and highlighting the specific record.
- **Movement History:** Detailed history of entry/exit movements for each material (Date and Time).
- **Critical Stock Alerts:** Automatic notifications for items falling below defined thresholds.

### 🔢 Stock Count Module
![Stock Count](/public/screenshots/stock-count.png)
- **Instant Comparison:** Instantly compares physical counts with system stock.
- **Blind Count:** A mode allowing staff to count without seeing system stock values.
- **Discrepancy Reporting:** Automatically reports mismatched items and exports them as PDF/XLS.

### 📱 Mobile Responsiveness
<img src="/public/screenshots/mobile-view.png" width="300" alt="Mobile View" />
- **Responsive Design:** Fully compatible interface on all tablets and phones.
- **Mobile-First Menu:** Easily accessible navigation and touch-friendly buttons.

### 🛡️ Security & RBAC (Role-Based Access Control)
- **Granular Authorization:** Fine-grained permission system like `inventory.create`, `inventory.delete`, `users.manage`.
- **Dynamic Role Management:** Instant assignment/revocation of role permissions via the Admin (Project Owner) panel.
- **Safe Deletion:** Protection mechanisms for deleting and undoing stock movements, requiring Project Owner approval.
- **Secure Authentication:** Encrypted, session-based login system with NextAuth.js.

### 🌍 Multi-Language Support (I18n)
- **Full Localization:** Complete support for Turkish (TR) and English (EN).
- **Dynamic Language Switching:** Instant language toggling via the interface with user preference memory.

### 🤖 Intra Arc (AI Assistant)
- **Google Gemini Integration:** Query stock data using natural language processing.
- **Smart Analysis:** Instant answers to questions like "Which items are critical?" or "Which company transacted last?".

---

## 🏗 Project Structure

```
inventory-app/
├── 📂 app/
│   ├── 📂 api/              # Backend API routes (Next.js Route Handlers)
│   ├── 📂 dashboard/        # Main admin panel pages
│   │   ├── 📂 inventory/    # Stock list and detail pages
│   │   ├── 📂 reports/      # Reporting screens
│   │   └── 📂 users/        # User and Role management (RBAC)
│   └── 📂 login/            # Login page
├── 📂 components/           # Reusable UI components
├── 📂 lib/                  # Helper functions, DB and Auth configs
│   ├── db.ts               # Prisma database client
│   ├── permissions.ts      # RBAC permission control mechanism
│   └── i18n.ts             # Translation dictionaries and configuration
├── 📂 prisma/               # Database schema
└── 📂 public/               # Static files
```

---

## 🛠 Technologies Used

| Category | Technology | Description |
|----------|-----------|----------|
| **Frontend** | Next.js 15 | Modern React framework with App Router |
| **Language** | TypeScript | Type-safe development |
| **Styling** | Tailwind CSS v4 | Fast and flexible UI design |
| **Database** | PostgreSQL (Supabase) | Scalable and secure database |
| **ORM** | Prisma | Database management and type-safe queries |
| **Auth** | NextAuth.js | Secure authentication solution |
| **I18n** | React Context | Lightweight and performant client-side translation |
| **AI** | Google Gemini | Generative AI integration |

---

## 🚀 Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/iwallplace/Track-Base.git
   cd inventory-app
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables (.env)**
   Create a `.env` file and enter your database and auth secrets.

4. **Push Database Schema**
   ```bash
   npx prisma db push
   ```

5. **Start the Application**
   ```bash
   npm run dev
   ```

---

## ⚙️ Detailed Configuration Guide

### 1. Setting up the Database (Supabase)

To store your inventory data, you need a PostgreSQL database. We recommend Supabase for its ease of use and free tier.

1.  Go to [Supabase](https://supabase.com/) and create a new project.
2.  Once created, go to **Project Settings** > **Database**.
3.  Under **Connection String**, select **URI**.
4.  Copy the connection string. It should look like this:
    `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres`
    *(Make sure to replace `[YOUR-PASSWORD]` with the database password you set during project creation.)*
5.  Use this value for the `DATABASE_URL` environment variable.

### 2. Getting Gemini AI API Key

The AI assistant feature requires a Google Gemini API Key.

1.  Visit [Google AI Studio](https://aistudio.google.com/).
2.  Click on **"Get API key"** in the sidebar.
3.  Click **"Create API key"**.
4.  Copy the generated key (starts with `AIza...`).
5.  Use this value for the `GOOGLE_API_KEY` environment variable.

### 3. Setting up the Project Owner (Admin)

When you first install the application, the database will be empty. You need to create an initial admin account.

1.  Open your `.env` file and add the following variables (optional, defaults provided below):
    ```env
    ADMIN_EMAIL=your-email@company.com
    ADMIN_PASSWORD=secure-password
    ```
2.  Run the following command in your terminal to seed the database:
    ```bash
    npx prisma db seed
    ```
3.  This command creates the **Admin (Project Owner)** account.
    *   **Default Email:** `admin@example.com` (or what you set in .env)
    *   **Default Password:** `Admin123!` (or what you set in .env)

> [!IMPORTANT]
> **Change these credentials immediately after logging in** via the User Management panel.

---

## ☁️ Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fiwallplace%2FTrack-Base&env=DATABASE_URL,NEXTAUTH_SECRET,GOOGLE_API_KEY&envDescription=Enter%20your%20database%20connection%20string%20and%20API%20keys&project-name=track-base&repository-name=track-base)

### Option 2: Manual Deployment

1.  Push your code to a Git repository (GitHub, GitLab, Bitbucket).
2.  Import your project into Vercel.
3.  **Environment Variables:** Add the following variables in the Vercel Project Settings:
    *   `DATABASE_URL`: Your PostgreSQL connection string (e.g. Supabase).
    *   `NEXTAUTH_SECRET`: A random string for authentication security.
    *   `NEXTAUTH_URL`: Your Vercel domain (e.g. `https://your-project.vercel.app`).
    *   `GOOGLE_API_KEY`: API Key for Gemini AI features.

4.  **Build Command:**
    Vercel automatically detects Next.js. However, to ensure your database schema is up-to-date, override the **Build Command** in settings:
    ```bash
    npx prisma db push && next build
    ```

5.  Click **Deploy**!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). All rights reserved © 2026.
