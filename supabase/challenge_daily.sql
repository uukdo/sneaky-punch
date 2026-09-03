alter table challenge_scores add column if not exists play_date date not null default (timezone('Asia/Seoul', now()))::date;
update challenge_scores set play_date = (timezone('Asia/Seoul', now()))::date where play_date is null;
alter table challenge_scores drop constraint if exists challenge_scores_name_key;
alter table challenge_scores add constraint challenge_scores_name_play_date_key unique (name, play_date);

create or replace function submit_challenge_score(p_name text, p_punches int)
returns void language plpgsql as $$
declare
  v_date date := (timezone('Asia/Seoul', now()))::date;
begin
  insert into challenge_scores (name, punches, play_date)
  values (p_name, p_punches, v_date)
  on conflict (name, play_date)
  do update set punches = greatest(challenge_scores.punches, excluded.punches);
end;
$$;

create or replace function rename_challenge_score(p_old_name text, p_new_name text)
returns void language plpgsql as $$
declare
  v_date date := (timezone('Asia/Seoul', now()))::date;
  v_old_punches int;
  v_new_punches int;
begin
  select punches into v_old_punches from challenge_scores where name = p_old_name and play_date = v_date;
  if v_old_punches is null then
    raise exception 'no score for % today', p_old_name;
  end if;
  select punches into v_new_punches from challenge_scores where name = p_new_name and play_date = v_date;
  if v_new_punches is null then
    update challenge_scores set name = p_new_name where name = p_old_name and play_date = v_date;
  else
    update challenge_scores set punches = greatest(v_old_punches, v_new_punches) where name = p_new_name and play_date = v_date;
    delete from challenge_scores where name = p_old_name and play_date = v_date;
  end if;
end;
$$;

grant execute on function rename_challenge_score(text, text) to anon;
