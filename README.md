# Task Tracking API

NestJS + PostgreSQL + Prisma, fully dockerized.

## Tech Stack

- NestJS
- PostgreSQL 16
- Prisma 6
- JWT Auth
- Swagger (OpenAPI)
- Docker Compose

## Prerequisites

- Node.js 22+
- Docker & Docker Compose
- npm

## Environment

Copy and adjust `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_db?schema=public"
JWT_SECRET="ganti-dengan-secret-yang-kuat"
```

> Saat full Docker, `DATABASE_URL` di-override otomatis oleh `docker-compose.yml` (`@db:5432`).

---

## Mode 1 — Database saja

Pakai ini kalau mau develop di host dengan hot reload (`npm run start:dev`).

```bash
# 1. Jalankan Postgres
docker compose up db -d

# 2. Install dependencies (sekali saja)
npm install

# 3. Migrate & generate Prisma Client
npx prisma migrate dev
npx prisma generate

# 4. Jalankan API di host
npm run start:dev
```

API: http://localhost:3000  
Swagger: http://localhost:3000/docs  
Postgres: `localhost:5432`

Stop DB:

```bash
docker compose stop db
```

---

## Mode 2 — Full (DB + API)

Semua jalan di dalam Docker.

```bash
# Build & start
docker compose up --build

# atau background
docker compose up --build -d
```

API: http://localhost:3000  
Swagger: http://localhost:3000/docs  
Postgres: `localhost:5432`

Stop:

```bash
docker compose down
```

Reset data DB (hapus volume):

```bash
docker compose down -v
```

---

## Endpoints penting

| Method | Path            | Auth     | Keterangan              |
|--------|-----------------|----------|-------------------------|
| GET    | `/`             | Public   | Health check            |
| GET    | `/health/db`    | Public   | Cek koneksi database    |
| POST   | `/auth/register`| Public   | Register user           |
| POST   | `/auth/login`   | Public   | Login, dapat JWT        |
| GET    | `/me`           | JWT      | Cek auth guard          |

### Contoh login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

Pakai token:

```bash
curl http://localhost:3000/me \
  -H "Authorization: Bearer <access_token>"
```

---

## Swagger

Setelah API jalan, buka:

```
http://localhost:3000/docs
```

Klik **Authorize**, isi:

```
Bearer <access_token>
```

---

## Prisma useful commands

```bash
npx prisma migrate dev --name <nama>
npx prisma generate
npx prisma studio
npx prisma migrate deploy   # production
```

---

## Project structure (singkat)

```
src/
  auth/           # JWT auth, guard, public decorator
  prisma/         # PrismaModule & PrismaService
  app.controller.ts
  app.module.ts
  main.ts
prisma/
  schema.prisma
docker-compose.yml
Dockerfile
```

---

## Troubleshooting

**DB belum ready**
```bash
docker compose ps
docker compose logs db
```

**Prisma client error**
```bash
npx prisma generate
```

**Port already in use**
Ubah mapping port di `docker-compose.yml` (mis. `"3001:3000"`).