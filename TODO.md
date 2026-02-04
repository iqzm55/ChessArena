# ChessArena PostgreSQL Migration TODO

## Backend Migration
- [ ] Update backend/package.json scripts and dependencies
- [ ] Update backend/config.ts for PostgreSQL with env vars
- [ ] Rewrite backend/db/index.ts to use pg with proper TypeScript types
- [ ] Update database calls in backend/middleware/auth.ts
- [ ] Update database calls in backend/routes/auth.ts
- [ ] Update database calls in backend/websocket.ts
- [ ] Create .env template
- [ ] Write migrate.py script for data migration
- [ ] Fix TypeScript errors

## Frontend Updates
- [ ] Update src/lib/api.ts for configurable API base URL

## Deployment
- [ ] Test local PostgreSQL connection
- [ ] Run migration script if SQLite data exists
- [ ] Deploy to Railway
