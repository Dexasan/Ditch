-- Read-only inventory. Run as the database owner; includes inherited PUBLIC grants.
select jsonb_build_object(
  'relations', (select jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', c.relname, 'kind', c.relkind,
    'rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity,
    'options', c.reloptions, 'role', r.name,
    'privileges', array(select p from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p where has_table_privilege(r.name,c.oid,p)),
    'policies', (select jsonb_agg(jsonb_build_object('name',pol.polname,'roles',pol.polroles,'command',pol.polcmd,'using',pg_get_expr(pol.polqual,pol.polrelid),'check',pg_get_expr(pol.polwithcheck,pol.polrelid))) from pg_policy pol where pol.polrelid=c.oid)
  ) order by n.nspname,c.relname,r.name)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values ('anon'),('authenticated')) r(name)
  where c.relkind in ('r','p','v','m','f') and n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_toast%'
    and has_schema_privilege(r.name,n.oid,'USAGE')
    and has_table_privilege(r.name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')),
  'functions', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'security_definer',p.prosecdef,'config',p.proconfig,'role',r.name,'definition',case when p.prosecdef then pg_get_functiondef(p.oid) end) order by n.nspname,p.proname,r.name)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join (values ('anon'),('authenticated')) r(name)
  where n.nspname not in ('pg_catalog','information_schema') and has_schema_privilege(r.name,n.oid,'USAGE') and has_function_privilege(r.name,p.oid,'EXECUTE') and p.prokind='f'),
  'buckets', (select jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types)) from storage.buckets),
  'api_schemas', current_setting('pgrst.db_schemas',true)
) as inventory;
