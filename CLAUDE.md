# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Toletech is an agricultural storage marketplace backend API that connects storage owners with farmers, processors, and agents. Currently on the `feature/migrating-to-mongo` branch, migrating from SQLite/Sequelize to MongoDB/Mongoose.

## Tech Stack

- **Runtime:** Node.js with Express 5
- **Database:** MongoDB (Mongoose 8 ODM)
- **Auth:** JWT (jsonwebtoken + bcryptjs), cookie or Bearer token
- **Module System:** CommonJS (`require`/`module.exports`)
- **Language:** JavaScript (no TypeScript)

## Commands

```bash
npm start              # Run server (node server.js)
npm run dev            # Dev mode with nodemon (Windows SET command - may need cross-env on Unix)
npm run seeder         # Seed database via utils/seed.mongo.js
node utils/seed.mongo.js  # Seed directly
```

**No test runner, linter, or formatter is configured.**

## Architecture

MVC pattern: `routes/ → controllers/ → models/` with middleware for auth and error handling.

**Entry flow:** `server.js` loads env → imports `app.js` → connects MongoDB (`utils/db.js`) → starts Express on PORT 3000.

**API base path:** `/api/v1`

### Key Directories

- `models/` — Mongoose schemas: User, Storage, Reservation, Billing, Invoice
- `controllers/` — Business logic (fat controllers), named `*.controller.js`
- `routes/` — Express routers, named `*.routes.js`
- `middlewares/` — `auth.js` (JWT verification + role check), `errors.js` (global error handler), `catchAsyncErrors.js` (async wrapper)
- `utils/` — DB connection, JWT helper, email sender, API query features, seeder
- `config/` — Environment config, JWT config. `database.js` is deprecated (old Sequelize)

### Auth & RBAC

Five roles with hierarchical permissions defined in `rbac.json`:
- **ADMIN** — Full access
- **AGENT** — Manage users, storages, view/update reservations
- **PROPRIETAIRE** / **TRANSFORMATEUR** — Create/manage own storages
- **AGRICULTEUR** — Create/manage own reservations, search storages

Auth middleware: `isAuthenticatedUser` verifies JWT, `authorizeRoles(...roles)` checks permissions. Token is read from `req.cookies.token` or `Authorization: Bearer` header.

### Business Rules

- Only AGRICULTEUR (and ADMIN) can create reservations
- Only PROPRIETAIRE, TRANSFORMATEUR, AGENT, ADMIN can create storages
- Reservation overlap prevention on confirmed reservations (date range checks)
- Non-admins can only update pending (`EN_ATTENTE`) reservations
- Farmers can only cancel (set status to `ANNULÉ`), not confirm
- Storage owners see reservations related to their own storages
- Owner verification enforced on update/delete operations

### Response Patterns

Auth endpoints return `{ success: true, user, token }` with token set in cookie. Other endpoints use mixed formats — some return `{ message, data }`, others return direct JSON. Error handling is inconsistent: auth controllers use `catchAsyncErrors` wrapper, storage/reservation controllers use try-catch blocks.

## Deployment

- **Docker:** Multi-stage Dockerfile (Node 18 Alpine), `docker-compose.yml` with MongoDB service
- **AWS ECS:** GitHub Actions deploy on push to `develop` branch → ECR → ECS Fargate
- **Kubernetes:** Config in `k8/` (2 replicas, LoadBalancer)

## API Documentation

- OpenAPI 3.0 spec in `openapi.json`
- Postman collections: `toletech.postman.json`, `toletech-api.json`, plus per-resource collections

## Environment Variables

Configured via `.env` (or `config/config.env`). Key vars: `PORT`, `MONGO_URI`, `NODE_ENV`, `JWT_SECRET`, `JWT_EXPIRES_TIME`, `COOKIE_EXPIRES_TIME`. Cloudinary, Stripe, and SMTP vars exist but are not yet configured.

## Git Workflow

- Main branch: `mvp`
- Current branch: `feature/migrating-to-mongo`
- Deploy trigger: push to `develop`
