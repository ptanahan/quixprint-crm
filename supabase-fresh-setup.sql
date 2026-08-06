-- QUIXPRINT CRM — FRESH START DATABASE SETUP
-- Run this entire script once in a BRAND-NEW Supabase project.

create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Quixprint',
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  email text,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company text not null,
  website text,
  contact_name text,
  contact_title text,
  email text,
  phone text,
  industry text,
  location text,
  stage text not null default 'New Lead'
    check (stage in ('New Lead','Researching','Contacted','Follow-Up','Quoted','Won','Lost')),
  priority text not null default 'Normal'
    check (priority in ('Hot','Warm','Normal','Low')),
  owner_id uuid references auth.users(id) on delete set null,
  source text,
  products text,
  estimated_value numeric(12,2),
  last_contacted date,
  next_follow_up date,
  opportunity_summary text,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null
    check (activity_type in ('Call','Email','Meeting','Note','Quote')),
  subject text not null,
  body text,
  activity_date date not null default current_date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index leads_workspace_idx on public.leads(workspace_id);
create index leads_followup_idx on public.leads(next_follow_up);
create index leads_stage_idx on public.leads(stage);
create index activities_workspace_idx on public.activities(workspace_id);
create index activities_lead_idx on public.activities(lead_id);
create index activities_date_idx on public.activities(activity_date desc);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.workspace_members
    where workspace_id=ws and user_id=auth.uid()
  );
$$;

create policy "Members view workspace"
on public.workspaces for select
using (public.is_workspace_member(id));

create policy "Members view team"
on public.workspace_members for select
using (public.is_workspace_member(workspace_id));

create policy "Members view leads"
on public.leads for select
using (public.is_workspace_member(workspace_id));

create policy "Members add leads"
on public.leads for insert
with check (public.is_workspace_member(workspace_id));

create policy "Members update leads"
on public.leads for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members delete leads"
on public.leads for delete
using (public.is_workspace_member(workspace_id));

create policy "Members view activities"
on public.activities for select
using (public.is_workspace_member(workspace_id));

create policy "Members add activities"
on public.activities for insert
with check (public.is_workspace_member(workspace_id));

create policy "Members update activities"
on public.activities for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members delete activities"
on public.activities for delete
using (public.is_workspace_member(workspace_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  ws_id uuid;
begin
  insert into public.workspaces(name,created_by)
  values ('Quixprint',new.id)
  returning id into ws_id;

  insert into public.workspace_members(
    workspace_id,user_id,display_name,email,role
  )
  values(
    ws_id,
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),
    new.email,
    'admin'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.join_workspace(invite_code_input text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  target_id uuid;
  old_id uuid;
  member_count int;
  lead_count int;
begin
  select id into target_id
  from public.workspaces
  where invite_code=upper(trim(invite_code_input));

  if target_id is null then
    raise exception 'Invalid workspace code';
  end if;

  if exists(
    select 1 from public.workspace_members
    where workspace_id=target_id and user_id=auth.uid()
  ) then
    return;
  end if;

  select workspace_id into old_id
  from public.workspace_members
  where user_id=auth.uid()
  order by created_at
  limit 1;

  if old_id is not null then
    select count(*) into member_count
    from public.workspace_members
    where workspace_id=old_id;

    select count(*) into lead_count
    from public.leads
    where workspace_id=old_id;

    if member_count=1 and lead_count=0 then
      delete from public.workspace_members
      where workspace_id=old_id and user_id=auth.uid();

      delete from public.workspaces
      where id=old_id;
    end if;
  end if;

  insert into public.workspace_members(
    workspace_id,user_id,display_name,email,role
  )
  select
    target_id,
    u.id,
    coalesce(u.raw_user_meta_data->>'display_name',split_part(u.email,'@',1)),
    u.email,
    'member'
  from auth.users u
  where u.id=auth.uid();
end;
$$;

grant execute on function public.join_workspace(text) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

create trigger leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();
