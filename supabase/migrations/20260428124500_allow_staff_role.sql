begin;

alter table admin_profiles
alter column role set default 'staff';

alter table admin_profiles
drop constraint if exists admin_profiles_role_check;

alter table admin_profiles
add constraint admin_profiles_role_check
check (role in ('master', 'manager', 'staff'));

commit;
