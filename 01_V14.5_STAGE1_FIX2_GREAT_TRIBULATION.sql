begin;

do $$
begin
  if to_regclass('public.world_controls') is null then
    raise exception 'public.world_controls does not exist';
  end if;
  if to_regprocedure('public.is_game_admin()') is null then
    raise exception 'public.is_game_admin() does not exist';
  end if;
end $$;

create or replace function public.admin_great_tribulation_start(
  p_force boolean default true
)
returns public.world_controls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.world_controls%rowtype;
begin
  if not coalesce(public.is_game_admin(), false) then
    raise exception 'admin permission required' using errcode = '42501';
  end if;

  select *
  into v_row
  from public.world_controls
  where id = 1
  for update;

  if not found then
    raise exception 'world_controls id=1 not found';
  end if;

  update public.world_controls
  set
    great_tribulation_active = true,
    great_tribulation_started_at = now(),
    great_tribulation_ends_at = now() + interval '4 hours',
    great_tribulation_last_trigger = 'manual',
    great_tribulation_next_auto_check_at = null
  where id = 1
  returning * into v_row;

  insert into public.great_tribulation_events(event_type, actor_id, detail)
  values (
    'manual_start',
    auth.uid(),
    jsonb_build_object(
      'source', 'admin',
      'forced', true,
      'started_at', v_row.great_tribulation_started_at,
      'ends_at', v_row.great_tribulation_ends_at
    )
  );

  return v_row;
end;
$$;

create or replace function public.admin_great_tribulation_end(
  p_apply_cooldown boolean default true
)
returns public.world_controls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.world_controls%rowtype;
begin
  if not coalesce(public.is_game_admin(), false) then
    raise exception 'admin permission required' using errcode = '42501';
  end if;

  select *
  into v_row
  from public.world_controls
  where id = 1
  for update;

  if not found then
    raise exception 'world_controls id=1 not found';
  end if;

  update public.world_controls
  set
    great_tribulation_active = false,
    great_tribulation_last_ended_at = now(),
    great_tribulation_cooldown_until =
      case
        when coalesce(p_apply_cooldown, true) then now() + interval '48 hours'
        else null
      end,
    great_tribulation_next_auto_check_at =
      case
        when coalesce(p_apply_cooldown, true) then now() + interval '48 hours'
        else now() + interval '1 hour'
      end,
    great_tribulation_ends_at = null,
    great_tribulation_last_trigger = 'manual'
  where id = 1
  returning * into v_row;

  insert into public.great_tribulation_events(event_type, actor_id, detail)
  values (
    'manual_end',
    auth.uid(),
    jsonb_build_object(
      'source', 'admin',
      'apply_cooldown', coalesce(p_apply_cooldown, true),
      'cooldown_until', v_row.great_tribulation_cooldown_until
    )
  );

  return v_row;
end;
$$;

revoke all on function public.admin_great_tribulation_start(boolean) from public, anon;
revoke all on function public.admin_great_tribulation_end(boolean) from public, anon;

grant execute on function public.admin_great_tribulation_start(boolean) to authenticated;
grant execute on function public.admin_great_tribulation_end(boolean) to authenticated;

notify pgrst, 'reload schema';

commit;

select
  true as installed,
  'V14.5-STAGE1-FIX2-20260721'::text as schema_version,
  has_function_privilege(
    'authenticated',
    'public.admin_great_tribulation_start(boolean)',
    'EXECUTE'
  ) as start_ready,
  has_function_privilege(
    'authenticated',
    'public.admin_great_tribulation_end(boolean)',
    'EXECUTE'
  ) as end_ready,
  (
    select count(*) >= 0
    from public.great_tribulation_events
  ) as event_table_ready;
