-- Run after the patients table exists. The backend uses the server-only key so RLS can stay enabled.
create table if not exists public.caregivers (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  caretaker_name varchar(255) not null unique,
  mobile_number varchar(20) not null unique,
  password_hash varchar(255) not null,
  language varchar(50) not null default 'English',
  voice_helper varchar(50) not null default 'English',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.caregiver_sessions (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references public.caregivers(id) on delete cascade,
  token text not null unique,
  ip_address varchar(45),
  user_agent text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists caregivers_patient_id_idx on public.caregivers(patient_id);
create index if not exists caregiver_sessions_caregiver_id_idx on public.caregiver_sessions(caregiver_id);
create index if not exists caregiver_sessions_expires_at_idx on public.caregiver_sessions(expires_at);

alter table public.caregivers enable row level security;
alter table public.caregiver_sessions enable row level security;
