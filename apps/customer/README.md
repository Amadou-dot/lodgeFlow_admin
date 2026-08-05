<p align="center">
  <img src="https://raw.githubusercontent.com/Amadou-dot/Amadou-dot/main/assets/banners/lodgeflow-customer-portal-banner.png" 
       alt="LodgeFlow Customer Portal Banner" 
       width="100%" />
</p>

<h1 align="center">🏨 LodgeFlow – Customer Portal</h1>

<p align="center">
  <a href="https://lodgeflow.aseck.dev/" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Preview-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Preview"/>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white"/>
  <img src="https://img.shields.io/badge/HeroUI-FF6B6B?style=for-the-badge&logo=react&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white"/>
</p>

<p align="center">
  The customer-facing booking platform for LodgeFlow, a luxury wilderness resort. Built with Next.js 15, HeroUI v2, and modern web technologies for seamless guest experiences.
</p>

---

## ✨ Features

- **🏠 Cabin Browsing**: Explore luxury cabins with detailed amenities and pricing
- **📅 Booking System**: Seamless reservation flow with real-time availability
- **🍽️ Dining Reservations**: Book dining experiences and view daily menus
- **🎯 Experience Booking**: Reserve outdoor activities and special experiences
- **📱 Mobile Responsive**: Optimized for all devices with smooth animations
- **🌙 Dark Mode**: Full theme support with elegant transitions
- **🔍 Smart Filtering**: Advanced search and filtering for cabins and experiences
- **💳 Secure Payments**: Integrated payment processing for bookings

## 🛠 Tech Stack

- **Frontend**: [Next.js 15](https://nextjs.org/) • [HeroUI v2](https://heroui.com/) • [Tailwind CSS](https://tailwindcss.com/)
- **Backend**: [MongoDB](https://mongodb.com/) • [Mongoose ODM](https://mongoosejs.com/)
- **Tools**: [TypeScript](https://www.typescriptlang.org/) • [React Query](https://tanstack.com/query/) • [Framer Motion](https://www.framer.com/motion/)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- MongoDB (Atlas or local installation)

### Installation

```bash
# Clone the repository
git clone https://github.com/Amadou-dot/LodgeFlow.git
cd LodgeFlow

# Install dependencies
pnpm install

# Copy environment variables
cp .env.local.example .env.local
```

### Clerk Authentication Setup

1. Create a free account at [Clerk](https://clerk.com)
2. Create a new application in the [Clerk Dashboard](https://dashboard.clerk.com)
3. Go to **API Keys** and copy your keys
4. Add to `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
```

5. In Clerk Dashboard, configure these paths:
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in URL: `/`
   - After sign-up URL: `/`

### Database Setup

**MongoDB Atlas (Recommended)**

1. Create a free account at [MongoDB Atlas](https://mongodb.com/atlas)
2. Create a cluster and get your connection string
3. Add to `.env.local`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/lodgeflow
```

**Local MongoDB**

1. Install [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. Start the MongoDB service
3. Use the default local configuration (mongodb://localhost:27017/lodgeflow)

### Initialize & Run

```bash
# Test database connection
pnpm tsx scripts/test-connection.ts

# Start development server
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002) to view the customer portal.

> **Note**: The customer portal runs on port 3002 to avoid conflicts with the admin dashboard (port 3000).

## 📁 Project Structure

```
app/
├── cabins/          # Cabin browsing and details
├── dining/          # Dining reservations
├── experiences/     # Experience booking
├── contact/         # Contact information
├── api/            # API routes
└── layout.tsx      # Root layout

components/         # Reusable UI components
├── ui/            # Core UI components
└── BookingForm.tsx # Main booking components

hooks/             # Custom React hooks for data fetching
models/            # Shared MongoDB schemas
types/             # TypeScript definitions
lib/               # Utilities & configurations
```

## 🔧 Development Setup

### Setup pnpm (Required)

Add the following to your `.npmrc` file:

```bash
public-hoist-pattern[]=*@heroui/*
```

After modifying the `.npmrc` file, run `pnpm install` again.

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm type-check   # Run TypeScript checks
```

## 🔗 Related Projects

- **[LodgeFlow Admin Dashboard](https://github.com/Amadou-dot/LodgeFlow_admin)** - Management dashboard for hotel operations

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

---

<p align="center">
  Made by <a href="https://github.com/Amadou-dot">Amadou</a>
</p>
