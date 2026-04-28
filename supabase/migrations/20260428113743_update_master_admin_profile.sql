begin;

update admin_profiles
set manager_name = '차윤빈',
    login_id = 'seed',
    role = 'master',
    department_id = (select id from departments where name = '판교')
where auth_user_id = '4dc58808-03a9-4d51-8d0d-c27af342b908';

insert into admin_profiles (manager_name, login_id, auth_user_id, role, department_id)
select '차윤빈', 'seed', '4dc58808-03a9-4d51-8d0d-c27af342b908', 'master', d.id
from departments d
where d.name = '판교'
  and not exists (
      select 1
      from admin_profiles
      where auth_user_id = '4dc58808-03a9-4d51-8d0d-c27af342b908'
  );

commit;
