<p align="center">
  <img src="https://raw.githubusercontent.com/Amadou-dot/Amadou-dot/main/assets/banners/lodgeflow-admin-dashboard-banner.png" 
       alt="LodgeFlow Banner" 
       width="100%" />
</p>

<h1 align="center">🏨 LodgeFlow – Hotel Management System</h1>

<p align="center">
  <a href="https://lodgeflow-admin.aseck.dev/" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Preview-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Preview"/>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white"/>
  <img src="https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white"/>
</p>

<p align="center">
  A modern hotel management dashboard built with Next.js 16, HeroUI, and MongoDB. Features comprehensive cabin management, booking system, customer profiles, and business analytics.
</p>

---

## ✨ Features

- **📊 Dashboard**: Real-time statistics, revenue charts, occupancy rates
- **🏠 Cabin Management**: CRUD operations, filtering, capacity management
- **📅 Booking System**: Reservation management, status tracking, payment processing
- **👥 Customer Profiles**: Guest information, booking history, preferences
- **⚙️ Settings**: Business rules, pricing, policies configuration
- **🌙 Dark Mode**: Full theme support with smooth transitions
- **📱 Mobile Responsive**: Optimized for all device sizes

## 🛠 Tech Stack

- **Frontend**: [Next.js 16](https://nextjs.org/) • [HeroUI v2](https://heroui.com/) • [Tailwind CSS](https://tailwindcss.com/)
- **Backend**: [MongoDB](https://mongodb.com/) • [Mongoose ODM](https://mongoosejs.com/)
- **Tools**: [TypeScript](https://www.typescriptlang.org/) • [SWR](https://swr.vercel.app/) • [Recharts](https://recharts.org/)

## 🚀 Quick Start

This app lives at `apps/admin` in the LodgeFlow monorepo. See the root
[`README.md`](../../README.md) for workspace-wide scripts — e.g. `pnpm dev:admin`
run from the repository root is equivalent to `pnpm dev` run from `apps/admin`,
as in the steps below.

### Prerequisites
- Node.js 18+ and pnpm
- MongoDB (Atlas or local installation)

### Installation

```bash
# Clone the repository (this is the monorepo root, not this app alone)
git clone https://github.com/Amadou-dot/lodgeFlow_admin.git
cd lodgeFlow_admin

# Install dependencies for the whole workspace
pnpm install

# Move into this app — the commands below assume this as the working directory
cd apps/admin
```

### Database Setup

**MongoDB Atlas (Recommended)**
1. Create a free account at [MongoDB Atlas](https://mongodb.com/atlas)
2. Create a cluster and get your connection string
3. Add to `.env.local`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/lodgeflow
SEED_SECRET=replace-with-a-long-random-secret
```

`SEED_SECRET` is required for `/api/cron/seed`. Call the route with
`Authorization: Bearer <SEED_SECRET>`.

This is a minimal example for connecting to a database — `pnpm dev` and
`pnpm build` also need Clerk and Resend credentials. See
[`CLAUDE.md`](./CLAUDE.md#environment-variables-required) for the full list of
required and optional environment variables.

**Local MongoDB**
1. Install [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. Start the MongoDB service
3. Use the default local configuration

### Initialize & Run

```bash
# Test database connection
pnpm tsx scripts/test-connection.ts

# Seed with sample data
pnpm seed

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## 📁 Project Structure

```
app/
├── (auth)/           # Auth-protected routes
├── (dashboard)/      # Main dashboard routes
├── api/             # API routes
└── layout.tsx       # Root layout

components/          # Reusable UI components
hooks/              # Custom React hooks
models/             # MongoDB schemas
types/              # TypeScript definitions
lib/                # Utilities & configurations
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the [MIT License](../../LICENSE).

---

<p align="center">
  Made by <a href="https://github.com/Amadou-dot">Amadou</a>
</p>
