-- =============================================================================
-- GST tax invoices for Forge payments (slice W2-B1)
--
-- * public.billing_profiles: a learner's billing name, state and (optional)
--   GSTIN for B2B invoices. Learners manage their own.
-- * public.invoices: one tax invoice per captured paid payment, numbered in an
--   unbroken series per Indian financial year (FG/2026-27/000001), with the
--   seller and buyer details and the CGST+SGST / IGST split frozen at issue time.
-- * public.issue_invoice(payment, seller): idempotent; service role only.
--   Place of supply is the buyer's state when known, else the seller's.
--
-- Additive. Tested by supabase/tests/invoices.sql.
-- =============================================================================

create table public.billing_profiles (
  user_id    uuid primary key references public.users(id) on delete cascade,
  legal_name text check (legal_name is null or length(trim(legal_name)) between 1 and 120),
  gstin      text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  state_code text check (state_code is null or state_code ~ '^[0-9]{2}$'),
  address    text check (address is null or length(address) <= 300),
  updated_at timestamptz not null default now(),
  -- A GSTIN begins with the state code it is registered in.
  check (gstin is null or state_code is null or left(gstin, 2) = state_code)
);
alter table public.billing_profiles enable row level security;
create policy "Users manage own billing profile" on public.billing_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.billing_profiles to authenticated;
grant all on public.billing_profiles to service_role;

create table public.invoice_counters (
  fy      text primary key check (fy ~ '^[0-9]{4}-[0-9]{2}$'),
  last_no integer not null default 0
);
alter table public.invoice_counters enable row level security;
revoke all on public.invoice_counters from authenticated, anon;
grant all on public.invoice_counters to service_role;

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_no     text not null unique,
  fy             text not null,
  seq            integer not null check (seq > 0),
  payment_id     uuid not null unique references public.payments(id) on delete restrict,
  user_id        uuid not null references public.users(id) on delete restrict,
  issued_at      timestamptz not null default now(),
  seller         jsonb not null check (seller ? 'name' and seller ? 'gstin' and seller ? 'state_code'),
  buyer_name     text not null,
  buyer_email    text,
  buyer_gstin    text,
  buyer_address  text,
  place_of_supply text not null check (place_of_supply ~ '^[0-9]{2}$'),
  description    text not null,
  sac_code       text not null default '999293',
  taxable_paise  integer not null check (taxable_paise >= 0),
  cgst_paise     integer not null default 0 check (cgst_paise >= 0),
  sgst_paise     integer not null default 0 check (sgst_paise >= 0),
  igst_paise     integer not null default 0 check (igst_paise >= 0),
  total_paise    integer not null check (total_paise > 0),
  currency       text not null default 'INR',
  unique (fy, seq),
  check (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise),
  check (igst_paise = 0 or (cgst_paise = 0 and sgst_paise = 0))
);
create index invoices_user on public.invoices (user_id, issued_at desc);
alter table public.invoices enable row level security;
create policy "Users read own invoices" on public.invoices for select to authenticated using (user_id = auth.uid());
revoke all on public.invoices from authenticated, anon;
grant select on public.invoices to authenticated;
grant all on public.invoices to service_role;

-- Invoices are records: they can't be edited or deleted once issued.
create function public.invoices_immutable() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Invoices cannot be changed once issued' using errcode = 'check_violation';
end $$;
create trigger invoices_immutable before update or delete on public.invoices
  for each row execute function public.invoices_immutable();

-- India's financial year (April–March) for a moment, as '2026-27'.
create function public.india_fy(p_at timestamptz) returns text language sql stable set search_path = '' as $$
  select case when extract(month from (p_at at time zone 'Asia/Kolkata')) >= 4
              then to_char(p_at at time zone 'Asia/Kolkata', 'YYYY') || '-' || to_char((p_at at time zone 'Asia/Kolkata') + interval '1 year', 'YY')
              else to_char((p_at at time zone 'Asia/Kolkata') - interval '1 year', 'YYYY') || '-' || to_char(p_at at time zone 'Asia/Kolkata', 'YY') end;
$$;

create function public.issue_invoice(p_payment uuid, p_seller jsonb) returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invoices;
  v_pay record;
  v_fy text;
  v_seq integer;
  v_pos text;
  v_tax integer;
begin
  if not (p_seller ? 'name' and p_seller ? 'gstin' and p_seller ? 'state_code') then
    raise exception 'Seller details are incomplete' using errcode = 'check_violation';
  end if;

  select * into v_inv from public.invoices where payment_id = p_payment;
  if found then return v_inv; end if;

  select p.*, u.email, u.full_name, coalesce(pl.name, 'Forge purchase') as plan_name,
         bp.legal_name, bp.gstin as buyer_gstin, bp.state_code as buyer_state, bp.address as buyer_address
    into v_pay
    from public.payments p
    join public.users u on u.id = p.user_id
    left join public.plans pl on pl.id = p.plan_id
    left join public.billing_profiles bp on bp.user_id = p.user_id
   where p.id = p_payment
   for update of p;
  if not found then raise exception 'Payment not found' using errcode = 'no_data_found'; end if;
  -- Someone else may have issued it while we waited for the lock.
  select * into v_inv from public.invoices where payment_id = p_payment;
  if found then return v_inv; end if;
  if v_pay.status <> 'captured' or v_pay.final_amount <= 0 then
    raise exception 'Only paid payments get an invoice' using errcode = 'check_violation';
  end if;

  v_fy := public.india_fy(v_pay.updated_at);
  insert into public.invoice_counters (fy, last_no) values (v_fy, 1)
    on conflict (fy) do update set last_no = public.invoice_counters.last_no + 1
    returning last_no into v_seq;

  v_pos := coalesce(v_pay.buyer_state, p_seller->>'state_code');
  v_tax := least(v_pay.tax_amount, v_pay.final_amount);

  insert into public.invoices (invoice_no, fy, seq, payment_id, user_id, issued_at, seller, buyer_name, buyer_email, buyer_gstin,
                               buyer_address, place_of_supply, description, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise)
  values ('FG/' || v_fy || '/' || lpad(v_seq::text, 6, '0'), v_fy, v_seq, v_pay.id, v_pay.user_id, v_pay.updated_at, p_seller,
          coalesce(nullif(trim(v_pay.legal_name), ''), nullif(trim(v_pay.full_name), ''), v_pay.email), v_pay.email, v_pay.buyer_gstin,
          v_pay.buyer_address, v_pos,
          coalesce(nullif(v_pay.description, ''), v_pay.plan_name || ' (' || v_pay.billing_cycle::text || ')'),
          v_pay.final_amount - v_tax,
          case when v_pos = p_seller->>'state_code' then v_tax / 2 + v_tax % 2 else 0 end,
          case when v_pos = p_seller->>'state_code' then v_tax / 2 else 0 end,
          case when v_pos = p_seller->>'state_code' then 0 else v_tax end,
          v_pay.final_amount)
  returning * into v_inv;
  return v_inv;
end $$;
revoke all on function public.issue_invoice(uuid, jsonb) from public, authenticated, anon;
grant execute on function public.issue_invoice(uuid, jsonb) to service_role;
