-- MotionForge standalone backend. This is intentionally separate from the
-- existing product-oriented video_studio tables used by the main site.

create table if not exists public.motionforge_plans (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  monthly_video_credits integer not null check (monthly_video_credits >= 0),
  stripe_price_id_test text,
  stripe_price_id_live text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.motionforge_plans
  (id, name, price_cents, monthly_video_credits, stripe_price_id_test, stripe_price_id_live, active)
values
  ('free', 'Free', 0, 2, null, null, true),
  ('starter', 'Starter', 1999, 6,
    'price_1U7yuOGu9yf7LXYcqGgeILRn',
    'price_1U7yp2Gu9yf7LXYcEhjeskZe', true)
on conflict (id) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  monthly_video_credits = excluded.monthly_video_credits,
  stripe_price_id_test = excluded.stripe_price_id_test,
  stripe_price_id_live = excluded.stripe_price_id_live,
  active = excluded.active,
  updated_at = now();

create table if not exists public.motionforge_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  plan_id text not null default 'free' references public.motionforge_plans(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.motionforge_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  prompt text not null check (length(btrim(prompt)) between 1 and 2000),
  source_image text not null check (length(source_image) <= 5000000),
  video_url text,
  duration_seconds integer not null check (duration_seconds in (5, 10)),
  aspect_ratio text not null check (aspect_ratio in ('9:16', '1:1', '16:9')),
  quality text not null check (quality in ('standard', 'high')),
  motion_strength integer not null check (motion_strength between 10 and 100),
  motion_preset text not null,
  status text not null default 'draft' check (status in ('draft', 'queued', 'running', 'completed', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.motionforge_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.motionforge_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null unique,
  provider text not null default 'n8n-grok',
  model text not null default 'grok',
  duration_seconds integer not null check (duration_seconds in (5, 10)),
  quality text not null check (quality in ('standard', 'high')),
  credits_reserved integer not null default 0 check (credits_reserved >= 0),
  credits_used integer not null default 0 check (credits_used >= 0),
  estimated_api_cost numeric(12,4) not null default 0 check (estimated_api_cost >= 0),
  actual_api_cost numeric(12,4) not null default 0 check (actual_api_cost >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'queued', 'running', 'completed', 'failed')),
  workflow_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.motionforge_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  transaction_type text not null check (transaction_type in ('free_grant', 'subscription_grant', 'generation_reservation', 'generation_refund', 'manual_adjustment')),
  generation_id uuid references public.motionforge_generations(id) on delete set null,
  payment_id text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.motionforge_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.motionforge_plans(id),
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists motionforge_one_subscription_per_user
  on public.motionforge_subscriptions(user_id)
  where status in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused');

create table if not exists public.motionforge_stripe_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.motionforge_daily_spend (
  spend_date date primary key,
  estimated_cost numeric(12,4) not null default 0 check (estimated_cost >= 0),
  actual_cost numeric(12,4) not null default 0 check (actual_cost >= 0),
  generation_count integer not null default 0 check (generation_count >= 0),
  paused boolean not null default false,
  pause_reason text,
  updated_at timestamptz not null default now()
);

create table if not exists public.motionforge_support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (length(btrim(subject)) between 1 and 160),
  message text not null check (length(btrim(message)) between 1 and 5000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.motionforge_plans enable row level security;
alter table public.motionforge_accounts enable row level security;
alter table public.motionforge_projects enable row level security;
alter table public.motionforge_generations enable row level security;
alter table public.motionforge_credit_ledger enable row level security;
alter table public.motionforge_subscriptions enable row level security;
alter table public.motionforge_stripe_events enable row level security;
alter table public.motionforge_daily_spend enable row level security;
alter table public.motionforge_support_requests enable row level security;

drop policy if exists motionforge_plans_read on public.motionforge_plans;
create policy motionforge_plans_read on public.motionforge_plans
  for select to anon, authenticated using (active = true);

drop policy if exists motionforge_accounts_own on public.motionforge_accounts;
create policy motionforge_accounts_own on public.motionforge_accounts
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists motionforge_projects_own on public.motionforge_projects;
create policy motionforge_projects_own on public.motionforge_projects
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists motionforge_generations_own_read on public.motionforge_generations;
create policy motionforge_generations_own_read on public.motionforge_generations
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists motionforge_credits_own_read on public.motionforge_credit_ledger;
create policy motionforge_credits_own_read on public.motionforge_credit_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists motionforge_subscriptions_own_read on public.motionforge_subscriptions;
create policy motionforge_subscriptions_own_read on public.motionforge_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists motionforge_support_own on public.motionforge_support_requests;
create policy motionforge_support_own on public.motionforge_support_requests
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.motionforge_bootstrap_account(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_user_id is null then raise exception 'user is required'; end if;
  insert into public.motionforge_accounts(user_id, display_name)
  select p_user_id, nullif(raw_user_meta_data->>'full_name', '')
  from auth.users where id = p_user_id
  on conflict (user_id) do nothing;
  insert into public.motionforge_credit_ledger(user_id, amount, transaction_type, idempotency_key, metadata)
  values (p_user_id, 2, 'free_grant', 'motionforge_free_grant:' || p_user_id::text,
    jsonb_build_object('source', 'free_plan'))
  on conflict (idempotency_key) do nothing;
end;
$$;

create or replace function public.motionforge_reserve_generation(
  p_user_id uuid,
  p_project_id uuid,
  p_request_key text,
  p_estimated_credits integer,
  p_duration_seconds integer,
  p_quality text,
  p_estimated_api_cost numeric,
  p_max_daily_spend numeric
)
returns table(generation_id uuid, reserved boolean, credits integer, reason text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  existing_id uuid;
  created_id uuid;
  available bigint;
  daily_estimate numeric;
  daily_paused boolean;
begin
  if p_user_id is null then raise exception 'user is required'; end if;
  if p_estimated_credits <= 0 or p_estimated_api_cost <= 0 then raise exception 'invalid generation estimate'; end if;
  if p_duration_seconds not in (5, 10) then raise exception 'invalid duration'; end if;
  if p_quality not in ('standard', 'high') then raise exception 'invalid quality'; end if;
  if p_max_daily_spend <= 0 then raise exception 'invalid daily spend limit'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select id into existing_id from public.motionforge_generations
    where user_id = p_user_id and request_key = p_request_key;
  if existing_id is not null then
    return query select existing_id, false, p_estimated_credits, 'duplicate'::text;
    return;
  end if;
  if not exists (select 1 from public.motionforge_projects where id = p_project_id and user_id = p_user_id) then
    raise exception 'project not found';
  end if;
  if exists (select 1 from public.motionforge_generations where project_id = p_project_id and status in ('reserved','queued','running')) then
    return query select null::uuid, false, p_estimated_credits, 'duplicate_project'::text;
    return;
  end if;
  select coalesce(sum(amount), 0) into available from public.motionforge_credit_ledger where user_id = p_user_id;
  if available < p_estimated_credits then
    return query select null::uuid, false, p_estimated_credits, 'insufficient_credits'::text;
    return;
  end if;
  insert into public.motionforge_daily_spend(spend_date) values (current_date) on conflict do nothing;
  select estimated_cost, paused into daily_estimate, daily_paused
    from public.motionforge_daily_spend where spend_date = current_date for update;
  if daily_paused or daily_estimate + p_estimated_api_cost > p_max_daily_spend then
    update public.motionforge_daily_spend set paused = true,
      pause_reason = 'Automatic generation spending circuit breaker.' where spend_date = current_date;
    return query select null::uuid, false, p_estimated_credits, 'daily_spend_limit'::text;
    return;
  end if;
  insert into public.motionforge_generations(project_id, user_id, request_key, duration_seconds, quality,
    credits_reserved, estimated_api_cost, status)
  values (p_project_id, p_user_id, p_request_key, p_duration_seconds, p_quality,
    p_estimated_credits, p_estimated_api_cost, 'reserved') returning id into created_id;
  insert into public.motionforge_credit_ledger(user_id, amount, transaction_type, generation_id, idempotency_key)
  values (p_user_id, -p_estimated_credits, 'generation_reservation', created_id,
    'motionforge_generation_reservation:' || created_id::text);
  update public.motionforge_daily_spend set estimated_cost = estimated_cost + p_estimated_api_cost,
    generation_count = generation_count + 1, updated_at = now() where spend_date = current_date;
  update public.motionforge_projects set status = 'queued', updated_at = now() where id = p_project_id;
  return query select created_id, true, p_estimated_credits, 'reserved'::text;
end;
$$;

create or replace function public.motionforge_mark_generation_queued(p_generation_id uuid, p_workflow_payload jsonb)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.motionforge_generations set status = 'queued', workflow_payload = coalesce(p_workflow_payload, '{}'::jsonb), updated_at = now()
    where id = p_generation_id and status = 'reserved';
  return found;
end;
$$;

create or replace function public.motionforge_complete_generation(
  p_generation_id uuid, p_output_payload jsonb, p_actual_credits integer, p_actual_api_cost numeric
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.motionforge_generations%rowtype;
declare delta integer;
begin
  select * into target from public.motionforge_generations where id = p_generation_id for update;
  if target.id is null or target.status = 'failed' then return false; end if;
  if nullif(btrim(coalesce(p_output_payload->>'video_url', '')), '') is null then
    raise exception 'completed generation requires a video URL';
  end if;
  delta := target.credits_reserved - greatest(0, p_actual_credits);
  if delta <> 0 then
    insert into public.motionforge_credit_ledger(user_id, amount, transaction_type, generation_id, idempotency_key, metadata)
    values (target.user_id, delta, case when delta > 0 then 'generation_refund' else 'generation_reservation' end,
      target.id, 'motionforge_generation_reconcile:' || target.id::text,
      jsonb_build_object('reserved', target.credits_reserved, 'actual', greatest(0, p_actual_credits)))
    on conflict (idempotency_key) do nothing;
  end if;
  update public.motionforge_generations set status = 'completed', output_payload = p_output_payload,
    credits_used = greatest(0, p_actual_credits), actual_api_cost = greatest(0, p_actual_api_cost),
    error = null, updated_at = now() where id = target.id;
  update public.motionforge_projects set status = 'completed', video_url = p_output_payload->>'video_url', error = null, updated_at = now()
    where id = target.project_id;
  update public.motionforge_daily_spend set actual_cost = actual_cost + greatest(0, p_actual_api_cost), updated_at = now()
    where spend_date = target.created_at::date;
  return true;
end;
$$;

create or replace function public.motionforge_fail_generation(p_generation_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.motionforge_generations%rowtype;
begin
  select * into target from public.motionforge_generations where id = p_generation_id for update;
  if target.id is null or target.status in ('completed','failed') then return false; end if;
  update public.motionforge_generations set status = 'failed', error = left(coalesce(p_reason, 'Generation failed.'), 1000), updated_at = now()
    where id = target.id;
  insert into public.motionforge_credit_ledger(user_id, amount, transaction_type, generation_id, idempotency_key, metadata)
  values (target.user_id, target.credits_reserved, 'generation_refund', target.id,
    'motionforge_generation_refund:' || target.id::text,
    jsonb_build_object('reason', left(coalesce(p_reason, 'Generation failed.'), 500)))
  on conflict (idempotency_key) do nothing;
  update public.motionforge_projects set status = 'failed', error = left(coalesce(p_reason, 'Generation failed.'), 1000), updated_at = now()
    where id = target.project_id;
  return true;
end;
$$;

revoke all on function public.motionforge_bootstrap_account(uuid) from public, anon, authenticated;
revoke all on function public.motionforge_reserve_generation(uuid, uuid, text, integer, integer, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.motionforge_mark_generation_queued(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.motionforge_complete_generation(uuid, jsonb, integer, numeric) from public, anon, authenticated;
revoke all on function public.motionforge_fail_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.motionforge_bootstrap_account(uuid) to service_role;
grant execute on function public.motionforge_reserve_generation(uuid, uuid, text, integer, integer, text, numeric, numeric) to service_role;
grant execute on function public.motionforge_mark_generation_queued(uuid, jsonb) to service_role;
grant execute on function public.motionforge_complete_generation(uuid, jsonb, integer, numeric) to service_role;
grant execute on function public.motionforge_fail_generation(uuid, text) to service_role;
