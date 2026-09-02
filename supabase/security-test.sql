-- Run after 011 inside a transaction, then ROLLBACK. No persistent test accounts.
insert into auth.users (id,email) values
 ('f1111111-1111-4111-8111-111111111111','security-a@example.invalid'),
 ('f2222222-2222-4222-8222-222222222222','security-b@example.invalid');
insert into public.channels (id,owner_id,slug,display_name) values
 ('fa111111-1111-4111-8111-111111111111','f1111111-1111-4111-8111-111111111111','security-test-a','Test A'),
 ('fb222222-2222-4222-8222-222222222222','f2222222-2222-4222-8222-222222222222','security-test-b','Test B');
insert into public.live_sessions (id,channel_id) values
 ('fc111111-1111-4111-8111-111111111111','fa111111-1111-4111-8111-111111111111'),
 ('fc222222-2222-4222-8222-222222222222','fb222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
do $$ begin
  if (select count(*) from public.channels) <> 1 then raise exception 'channel isolation failed'; end if;
  if (select count(*) from public.live_sessions) <> 1 then raise exception 'session isolation failed'; end if;
  if exists(select 1 from public.users where id <> auth.uid()) then raise exception 'profile isolation failed'; end if;
  if has_table_privilege(current_user,'public.participants','INSERT') then raise exception 'participant self-approval possible'; end if;
  if has_table_privilege(current_user,'public.chat_messages','INSERT') then raise exception 'direct chat spoofing possible'; end if;
  if has_table_privilege(current_user,'public.stream_destinations','SELECT') then raise exception 'credentials readable'; end if;
  if has_table_privilege(current_user,'public.saved_destinations','SELECT') then raise exception 'saved credentials readable'; end if;
  if has_function_privilege(current_user,'public.handle_new_user()','EXECUTE') then raise exception 'trigger publicly executable'; end if;
end $$;
select set_config('request.jwt.claim.sub','f2222222-2222-4222-8222-222222222222',true);
do $$ begin
  if exists(select 1 from public.channels where owner_id <> auth.uid()) then raise exception 'cross-owner channels'; end if;
  if (select count(*) from public.live_sessions) <> 1 then raise exception 'second user session isolation failed'; end if;
end $$;
set local role anon;
do $$ declare t text; begin
  foreach t in array array['users','channels','live_sessions','stream_destinations','saved_destinations','participants','chat_messages','community_posts','community_votes','channel_memberships','community_comments','community_post_events','community_notifications','show_rundown_items'] loop
    if has_table_privilege(current_user,'public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'anon privilege on %',t; end if;
  end loop;
end $$;
reset role;
select 'RLS isolation and direct-write denial passed' as result;
