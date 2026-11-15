-- Pulse: set the factory-default admin credentials to username 'Admin' / password 'Admin'.
--
-- This only touches the system user while it still carries the original seed
-- password hash from 01_init — i.e. a fresh install that has not yet rotated
-- the default. Installs that already changed the admin password (or username)
-- are left exactly as they are.
--
-- The password hash below is bcrypt('Admin', cost 10) and must stay identical
-- to SYSTEM_USER_PASSWORD_HASH in src/lib/password.ts, which the login and
-- onboarding flows compare against to detect an unchanged default password.
UPDATE "user"
SET "username" = 'Admin',
    "password" = '$2b$10$50MfWf8HkyQfP/CF5PSMBu6DHOoe5mk6m2QPMwZJioF3/I4wlh2Fm'
WHERE "user_id" = '41e2b680-648e-4b09-bcd7-3e2b10c06264'
  AND "password" = '$2b$10$BUli0c.muyCW1ErNJc3jL.vFRFtFJWrT8/GcR4A.sUdCznaXiqFXa';
