# Supabase + deploy setup

Wright stores documents in a Supabase Postgres database and gates the app
behind a single shared password. Follow these steps once.

## 1. Create the Supabase project

1. Sign up / log in at https://supabase.com and create a new project.
2. Pick a strong database password (you won't need it for the app) and a region
   close to you.

## 2. Create the document import tables

In the Supabase dashboard, open **SQL Editor** and run:

```sql
create extension if not exists "pgcrypto";

create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  title           text not null default 'Untitled Document',
  html            text not null default '',
  content_json    jsonb null,
  source_file_id  uuid null,
  import_status   text not null default 'ready',
  import_warnings jsonb null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists source_files (
  id                 uuid primary key default gen_random_uuid(),
  document_id        uuid null references documents(id) on delete set null,
  original_file_name text not null,
  file_type          text not null,
  mime_type          text null,
  file_size_bytes    bigint not null,
  storage_path       text not null,
  import_mode        text not null,
  created_at         timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_source_file_id_fkey'
  ) then
    alter table documents
      add constraint documents_source_file_id_fkey
      foreign key (source_file_id)
      references source_files(id)
      on delete set null;
  end if;
end $$;
```

If you already created the older `documents` table, run this instead:

```sql
alter table documents add column if not exists content_json jsonb null;
alter table documents add column if not exists source_file_id uuid null;
alter table documents add column if not exists import_status text not null default 'ready';
alter table documents add column if not exists import_warnings jsonb null;

create table if not exists source_files (
  id                 uuid primary key default gen_random_uuid(),
  document_id        uuid null references documents(id) on delete set null,
  original_file_name text not null,
  file_type          text not null,
  mime_type          text null,
  file_size_bytes    bigint not null,
  storage_path       text not null,
  import_mode        text not null,
  created_at         timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_source_file_id_fkey'
  ) then
    alter table documents
      add constraint documents_source_file_id_fkey
      foreign key (source_file_id)
      references source_files(id)
      on delete set null;
  end if;
end $$;
```

## 2b. Document Library migration (run after step 2)

The Document Library feature requires additional columns. In the SQL Editor, run:

```sql
-- Document Library columns
alter table documents add column if not exists is_starred    boolean      not null default false;
alter table documents add column if not exists is_trashed    boolean      not null default false;
alter table documents add column if not exists document_type text         not null default 'native';
alter table documents add column if not exists plain_text    text         null;
alter table documents add column if not exists word_count    integer      not null default 0;
alter table documents add column if not exists character_count integer    not null default 0;
alter table documents add column if not exists last_opened_at timestamptz null;

-- Index for fast library queries
create index if not exists documents_is_trashed_updated on documents (is_trashed, updated_at desc);
create index if not exists documents_is_starred_updated on documents (is_starred, is_trashed, updated_at desc);
```

Run this even if you already have the `documents` table — `add column if not exists` is safe on existing data.

## 3. Create the private source-file bucket

The app will try to create this bucket automatically with the service-role key.
You can also create it manually in the Supabase dashboard under **Storage**:

```txt
Bucket name: wright-source-files
Public bucket: off
```

All database access happens server-side with the service-role key, so you do
**not** need to configure Row-Level Security for this single-user setup.

## 4. Get your keys

In the dashboard: **Settings → API**. Copy:

- **Project URL** → `SUPABASE_URL`
- **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY`
  (the secret one, not `anon`. Never expose this in the browser.)

## 5. Set environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_PASSWORD=the-password-you-and-your-dad-type
SESSION_SECRET=<run: openssl rand -hex 32>
ANTHROPIC_API_KEY=...
```

Run locally with `npm run dev`.

## 6. Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. In the Vercel project: **Settings → Environment Variables**, add the same
   five variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD`,
   `SESSION_SECRET`, `ANTHROPIC_API_KEY`).
3. Deploy. Visiting the URL prompts for the password; after that, documents are
   created, edited, and autosaved to Supabase from any machine or browser.
