# Database access inventory - 2026-09-03

Captured directly from the linked production PostgreSQL catalog through the Supabase management API. PostgREST exposes `public` and `graphql_public`; `extensions` is an extra search path, not an exposed REST schema. SQL privileges below include inherited PUBLIC grants. Counts exclude pg_catalog/information_schema built-ins, which are not application REST resources.

The raw before/after JSON includes every discovered relation, policy expression, function signature, execution role, function search_path, and reachable SECURITY DEFINER definition. No database contents or credentials are included.

## Relations before the change

`Both` means anon and authenticated had the listed SQL privileges. RLS can still deny row access despite a table grant. TRUNCATE does not obey RLS; it is not exposed as a PostgREST HTTP operation, but these excessive grants were removed from application tables.

| Relation | Kind | Roles | RLS | Explicit policies before | API exposure |
|---|---|---|---|---|---|
| `extensions.pg_stat_statements` | v | Both | OFF / view N/A | None (default deny if RLS enabled) | Not an exposed REST schema |
| `extensions.pg_stat_statements_info` | v | Both | OFF / view N/A | None (default deny if RLS enabled) | Not an exposed REST schema |
| `public.channel_memberships` | r | Both | Enabled | channel_memberships: self delete; channel_memberships: self insert; channel_memberships: self or channel owner read; channel_memberships: self update | PostgREST / GraphQL |
| `public.channels` | r | Both | Enabled | channels: owner delete; channels: owner insert; channels: owner update; channels: public read | PostgREST / GraphQL |
| `public.chat_messages` | r | Both | Enabled | chat_messages: authenticated insert; chat_messages: public read | PostgREST / GraphQL |
| `public.community_comments` | r | Both | Enabled | community_comments: author or owner delete; community_comments: author or owner update; community_comments: public read; community_comments: self insert | PostgREST / GraphQL |
| `public.community_notifications` | r | Both | Enabled | community_notifications: recipient read; community_notifications: recipient update | PostgREST / GraphQL |
| `public.community_post_events` | r | Both | Enabled | community_post_events: channel owner insert; community_post_events: public read | PostgREST / GraphQL |
| `public.community_posts` | r | Both | Enabled | community_posts: authenticated insert; community_posts: author or owner delete; community_posts: owner update; community_posts: public read | PostgREST / GraphQL |
| `public.community_votes` | r | Both | Enabled | community_votes: authenticated insert; community_votes: self delete; community_votes: self or channel owner read | PostgREST / GraphQL |
| `public.live_sessions` | r | Both | Enabled | live_sessions: owner delete; live_sessions: owner insert; live_sessions: owner update; live_sessions: public read | PostgREST / GraphQL |
| `public.participants` | r | Both | Enabled | participants: owner delete; participants: owner update; participants: public read live only; participants: self insert | PostgREST / GraphQL |
| `public.saved_destinations` | r | Both | Enabled | saved_destinations: owner delete; saved_destinations: owner insert; saved_destinations: owner read; saved_destinations: owner update | PostgREST / GraphQL |
| `public.show_rundown_items` | r | Both | Enabled | show_rundown_items: channel owner all | PostgREST / GraphQL |
| `public.stream_destinations` | r | Both | Enabled | stream_destinations: owner delete; stream_destinations: owner insert; stream_destinations: owner read; stream_destinations: owner update | PostgREST / GraphQL |
| `public.users` | r | Both | Enabled | users: read own; users: update own | PostgREST / GraphQL |
| `realtime.messages` | p | Both | Enabled | None (default deny if RLS enabled) | Not an exposed REST schema |
| `realtime.subscription` | r | Both | OFF / view N/A | None (default deny if RLS enabled) | Not an exposed REST schema |
| `storage.buckets` | r | Both | Enabled | None (default deny if RLS enabled) | Not an exposed REST schema |
| `storage.buckets_analytics` | r | Both | Enabled | None (default deny if RLS enabled) | Not an exposed REST schema |
| `storage.buckets_vectors` | r | Both | Enabled | None (default deny if RLS enabled) | Not an exposed REST schema |
| `storage.objects` | r | Both | Enabled | None (default deny if RLS enabled) | Not an exposed REST schema |
| `storage.s3_multipart_uploads` | r | Both | Enabled | None (default deny if RLS enabled) | Not an exposed REST schema |
| `storage.s3_multipart_uploads_parts` | r | Both | Enabled | None (default deny if RLS enabled) | Not an exposed REST schema |
| `storage.vector_indexes` | r | Both | Enabled | None (default deny if RLS enabled) | Not an exposed REST schema |

Kinds: r = table, p = partitioned table, v = view. Views do not support RLS directly; invoker semantics or revoking access is required if exposed. The two extension statistics views and `realtime.subscription` have SQL SELECT grants and no RLS; they are provider-managed, outside the exposed REST schemas, and were not altered. Do not expose those schemas. All seven listed storage relations have RLS with no policies, so anon/authenticated row access is default-denied. `realtime.messages` likewise has no allowing policy. No Supabase storage buckets exist.

## Application boundary after migration 011

All 14 public tables have RLS and exactly one explicit `TO authenticated` SELECT policy. Anon has no privileges. Authenticated users have no INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privileges. Every mutation now goes through guarded server code; this also blocks choosing privileged participant/community columns in a direct PostgREST write. There are no blanket true policies or merely-logged-in policies left in the application schema.

| Table | Authenticated direct read scope | Direct credentials |
|---|---|---|
| users | `id = auth.uid()` | No |
| channels | `owner_id = auth.uid()` | No |
| live_sessions | Channel owner | No |
| participants | Participant's own user_id or channel owner | No |
| chat_messages | Channel owner | No |
| community_posts | Author or channel owner | No |
| community_votes | Voter's own user_id | No |
| channel_memberships | Member's own user_id or channel owner | No |
| community_comments | Author or channel owner | No |
| community_post_events | Actor or channel owner | No |
| community_notifications | Recipient | No |
| show_rundown_items | Session channel owner | No |
| stream_destinations | Owner policy exists, but SELECT grant revoked | Completely denied |
| saved_destinations | Owner policy exists, but SELECT grant revoked | Completely denied |

Public audience pages and community content remain intentional, explicit projections returned by the service-role API. Owning-user RLS protects the direct database path; it does not replace authorization in service-role API handlers.

## Function / RPC inventory

Before: 93 function signatures executable by each client role across non-system schemas. After: 91 per role. No application RPC remains executable. Trigger functions cannot be called as ordinary RPCs even before revocation, but their needless execution grants were removed. `handle_new_user()` already had `search_path=public`; it now uses an empty search path and a schema-qualified insert. Its bypass is intentional for the auth.users insert trigger. The live-only `rls_auto_enable()` event trigger already had `search_path=pg_catalog`; its DDL bypass is intentional. Those were the only reachable SECURITY DEFINER functions discovered. All other inventoried functions are invokers; function source bodies for those were not exhaustively reviewed.

Every signature below was executable by both anon and authenticated before the change. `public` execution grants were revoked. `graphql_public.graphql` remains executable and uses the remaining table grants/RLS for its schema. Other schemas are used internally by Supabase or extensions and are not exposed as application RPC schemas.

| Schema | Function and arguments | Definer | search_path | After |
|---|---|---|---|---|
| `auth` | `email()` | No | inherited | Unchanged |
| `auth` | `jwt()` | No | inherited | Unchanged |
| `auth` | `role()` | No | inherited | Unchanged |
| `auth` | `uid()` | No | inherited | Unchanged |
| `extensions` | `armor(bytea, text[], text[])` | No | inherited | Unchanged |
| `extensions` | `armor(bytea)` | No | inherited | Unchanged |
| `extensions` | `crypt(text, text)` | No | inherited | Unchanged |
| `extensions` | `dearmor(text)` | No | inherited | Unchanged |
| `extensions` | `decrypt(bytea, bytea, text)` | No | inherited | Unchanged |
| `extensions` | `decrypt_iv(bytea, bytea, bytea, text)` | No | inherited | Unchanged |
| `extensions` | `digest(text, text)` | No | inherited | Unchanged |
| `extensions` | `digest(bytea, text)` | No | inherited | Unchanged |
| `extensions` | `encrypt(bytea, bytea, text)` | No | inherited | Unchanged |
| `extensions` | `encrypt_iv(bytea, bytea, bytea, text)` | No | inherited | Unchanged |
| `extensions` | `gen_random_bytes(integer)` | No | inherited | Unchanged |
| `extensions` | `gen_random_uuid()` | No | inherited | Unchanged |
| `extensions` | `gen_salt(text, integer)` | No | inherited | Unchanged |
| `extensions` | `gen_salt(text)` | No | inherited | Unchanged |
| `extensions` | `grant_pg_cron_access()` | No | ['search_path=""'] | Unchanged |
| `extensions` | `grant_pg_graphql_access()` | No | ['search_path=""'] | Unchanged |
| `extensions` | `grant_pg_net_access()` | No | ['search_path=""'] | Unchanged |
| `extensions` | `hmac(text, text, text)` | No | inherited | Unchanged |
| `extensions` | `hmac(bytea, bytea, text)` | No | inherited | Unchanged |
| `extensions` | `pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone)` | No | inherited | Unchanged |
| `extensions` | `pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone)` | No | inherited | Unchanged |
| `extensions` | `pgp_armor_headers(text, OUT key text, OUT value text)` | No | inherited | Unchanged |
| `extensions` | `pgp_key_id(bytea)` | No | inherited | Unchanged |
| `extensions` | `pgp_pub_decrypt(bytea, bytea, text, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_pub_decrypt(bytea, bytea, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_pub_decrypt(bytea, bytea)` | No | inherited | Unchanged |
| `extensions` | `pgp_pub_decrypt_bytea(bytea, bytea, text, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_pub_decrypt_bytea(bytea, bytea, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_pub_decrypt_bytea(bytea, bytea)` | No | inherited | Unchanged |
| `extensions` | `pgp_pub_encrypt(text, bytea)` | No | inherited | Unchanged |
| `extensions` | `pgp_pub_encrypt(text, bytea, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_pub_encrypt_bytea(bytea, bytea)` | No | inherited | Unchanged |
| `extensions` | `pgp_pub_encrypt_bytea(bytea, bytea, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_sym_decrypt(bytea, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_sym_decrypt(bytea, text, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_sym_decrypt_bytea(bytea, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_sym_decrypt_bytea(bytea, text, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_sym_encrypt(text, text, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_sym_encrypt(text, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_sym_encrypt_bytea(bytea, text)` | No | inherited | Unchanged |
| `extensions` | `pgp_sym_encrypt_bytea(bytea, text, text)` | No | inherited | Unchanged |
| `extensions` | `pgrst_ddl_watch()` | No | ['search_path=""'] | Unchanged |
| `extensions` | `pgrst_drop_watch()` | No | ['search_path=""'] | Unchanged |
| `extensions` | `set_graphql_placeholder()` | No | ['search_path=""'] | Unchanged |
| `extensions` | `uuid_generate_v1()` | No | inherited | Unchanged |
| `extensions` | `uuid_generate_v1mc()` | No | inherited | Unchanged |
| `extensions` | `uuid_generate_v3(namespace uuid, name text)` | No | inherited | Unchanged |
| `extensions` | `uuid_generate_v4()` | No | inherited | Unchanged |
| `extensions` | `uuid_generate_v5(namespace uuid, name text)` | No | inherited | Unchanged |
| `extensions` | `uuid_nil()` | No | inherited | Unchanged |
| `extensions` | `uuid_ns_dns()` | No | inherited | Unchanged |
| `extensions` | `uuid_ns_oid()` | No | inherited | Unchanged |
| `extensions` | `uuid_ns_url()` | No | inherited | Unchanged |
| `extensions` | `uuid_ns_x500()` | No | inherited | Unchanged |
| `graphql_public` | `graphql("operationName" text, query text, variables jsonb, extensions jsonb)` | No | inherited | Unchanged |
| `public` | `handle_new_user()` | Yes | ['search_path=public'] | Revoked |
| `public` | `rls_auto_enable()` | Yes | ['search_path=pg_catalog'] | Revoked |
| `realtime` | `apply_rls(wal jsonb, max_record_bytes integer)` | No | inherited | Unchanged |
| `realtime` | `broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text)` | No | inherited | Unchanged |
| `realtime` | `build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[])` | No | inherited | Unchanged |
| `realtime` | `cast(val text, type_ regtype)` | No | inherited | Unchanged |
| `realtime` | `check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text)` | No | inherited | Unchanged |
| `realtime` | `check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean)` | No | inherited | Unchanged |
| `realtime` | `is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[])` | No | inherited | Unchanged |
| `realtime` | `list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer)` | No | ['log_min_messages=fatal'] | Unchanged |
| `realtime` | `quote_wal2json(entity regclass)` | No | inherited | Unchanged |
| `realtime` | `send(payload jsonb, event text, topic text, private boolean)` | No | inherited | Unchanged |
| `realtime` | `send_binary(payload bytea, event text, topic text, private boolean)` | No | inherited | Unchanged |
| `realtime` | `subscription_check_filters()` | No | inherited | Unchanged |
| `realtime` | `to_regrole(role_name text)` | No | inherited | Unchanged |
| `realtime` | `topic()` | No | inherited | Unchanged |
| `realtime` | `wal2json_escape_identifier(name text)` | No | inherited | Unchanged |
| `storage` | `allow_any_operation(expected_operations text[])` | No | inherited | Unchanged |
| `storage` | `allow_only_operation(expected_operation text)` | No | inherited | Unchanged |
| `storage` | `can_insert_object(bucketid text, name text, owner uuid, metadata jsonb)` | No | inherited | Unchanged |
| `storage` | `enforce_bucket_name_length()` | No | inherited | Unchanged |
| `storage` | `extension(name text)` | No | inherited | Unchanged |
| `storage` | `filename(name text)` | No | inherited | Unchanged |
| `storage` | `foldername(name text)` | No | inherited | Unchanged |
| `storage` | `get_common_prefix(p_key text, p_prefix text, p_delimiter text)` | No | inherited | Unchanged |
| `storage` | `get_size_by_bucket()` | No | inherited | Unchanged |
| `storage` | `list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text)` | No | inherited | Unchanged |
| `storage` | `list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text, sort_order text)` | No | inherited | Unchanged |
| `storage` | `operation()` | No | inherited | Unchanged |
| `storage` | `protect_delete()` | No | inherited | Unchanged |
| `storage` | `search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text)` | No | inherited | Unchanged |
| `storage` | `search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text)` | No | inherited | Unchanged |
| `storage` | `search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text)` | No | inherited | Unchanged |
| `storage` | `update_updated_at_column()` | No | inherited | Unchanged |
