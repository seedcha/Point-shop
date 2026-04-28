-- Apply schema changes after the initial bootstrap migration.
-- This file is intentionally written as a delta migration so it can run
-- after 202604280001_initial.sql without trying to recreate existing tables.

begin;

create extension if not exists pgcrypto;

-- Ensure seed departments exist before backfilling new department_id columns.
insert into departments (name) values
('대치'), ('판교')
on conflict (name) do nothing;

-- 관리자: login_id 추가
alter table admin_profiles
add column if not exists login_id varchar(50);

update admin_profiles
set login_id = case
    when auth_user_id = '78461524-de43-4394-8c1e-77cf71935ba7' then 'seed'
    else 'manager_' || left(id::text, 8)
end
where login_id is null;

alter table admin_profiles
alter column login_id set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'admin_profiles_login_id_key'
    ) then
        alter table admin_profiles
        add constraint admin_profiles_login_id_key unique (login_id);
    end if;
end $$;

-- 시간표: 가맹점 연결, student_counts 제거, 가맹점 포함 중복 제약으로 변경
alter table timetable
add column if not exists department_id uuid;

update timetable
set department_id = (select id from departments where name = '판교')
where department_id is null;

alter table timetable
alter column department_id set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'timetable_department_id_fkey'
    ) then
        alter table timetable
        add constraint timetable_department_id_fkey
        foreign key (department_id) references departments(id) on delete restrict;
    end if;
end $$;

alter table timetable
drop column if exists student_counts;

alter table timetable
drop constraint if exists timetable_class_name_day_of_week_start_time_key;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'timetable_department_id_class_name_day_of_week_start_time_key'
    ) then
        alter table timetable
        add constraint timetable_department_id_class_name_day_of_week_start_time_key
        unique (department_id, class_name, day_of_week, start_time);
    end if;
end $$;

-- 학생과 수업 간의 다대다 관계 테이블
create table if not exists student_classes (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    class_id uuid not null references timetable(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (student_id, class_id)
);

-- 상품: 가맹점 연결 추가
alter table products
add column if not exists department_id uuid;

update products
set department_id = (select id from departments where name = '판교')
where department_id is null;

alter table products
alter column department_id set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'products_department_id_fkey'
    ) then
        alter table products
        add constraint products_department_id_fkey
        foreign key (department_id) references departments(id) on delete cascade;
    end if;
end $$;

-- 구매 내역: 상태 및 업데이트 시간 추가
alter table purchases
add column if not exists status varchar(20) not null default 'completed';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'purchases_status_check'
    ) then
        alter table purchases
        add constraint purchases_status_check
        check (status in ('completed', 'cancelled', 'refunded'));
    end if;
end $$;

alter table purchases
add column if not exists updated_at timestamptz not null default now();

-- 포인트 이력: 거래 유형 추가
alter table point_transactions
add column if not exists transaction_type varchar(30);

update point_transactions
set transaction_type = case
    when purchase_id is not null then 'purchase'
    else 'etc'
end
where transaction_type is null;

alter table point_transactions
alter column transaction_type set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'point_transactions_transaction_type_check'
    ) then
        alter table point_transactions
        add constraint point_transactions_transaction_type_check
        check (transaction_type in ('attendance', 'purchase', 'refund', 'etc'));
    end if;
end $$;

-- 출석 로그: 수업 연결 추가. 기존 로그가 있는데 수업이 없으면 백필용 수업을 만든다.
insert into timetable (department_id, class_name, day_of_week, start_time, end_time)
select d.id, '미지정 수업', '월', '00:00', '00:01'
from departments d
where d.name = '판교'
  and exists (select 1 from attendance_logs)
  and not exists (select 1 from timetable);

alter table attendance_logs
add column if not exists class_id uuid;

update attendance_logs
set class_id = (select id from timetable order by created_at, id limit 1)
where class_id is null;

alter table attendance_logs
alter column class_id set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'attendance_logs_class_id_fkey'
    ) then
        alter table attendance_logs
        add constraint attendance_logs_class_id_fkey
        foreign key (class_id) references timetable(id) on delete cascade;
    end if;
end $$;

alter table attendance_logs
drop constraint if exists attendance_logs_student_id_date_key;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'attendance_logs_student_id_class_id_date_key'
    ) then
        alter table attendance_logs
        add constraint attendance_logs_student_id_class_id_date_key
        unique (student_id, class_id, date);
    end if;
end $$;

-- indexes for performance optimization
create index if not exists idx_admin_profiles_department_id
on admin_profiles(department_id);

create index if not exists idx_timetable_department_id
on timetable(department_id);

create index if not exists idx_student_classes_class_id
on student_classes(class_id);

create index if not exists idx_student_classes_student_id
on student_classes(student_id);

create index if not exists idx_products_department_id
on products(department_id);

create index if not exists idx_point_transactions_student_id
on point_transactions(student_id);

-- Seed/update master admin profile.
update admin_profiles
set manager_name = '차윤빈',
    login_id = 'seed',
    role = 'master',
    department_id = (select id from departments where name = '판교')
where auth_user_id = '78461524-de43-4394-8c1e-77cf71935ba7';

insert into admin_profiles (manager_name, login_id, auth_user_id, role, department_id)
select '차윤빈', 'seed', '78461524-de43-4394-8c1e-77cf71935ba7', 'master', d.id
from departments d
where d.name = '판교'
  and not exists (
      select 1
      from admin_profiles
      where auth_user_id = '78461524-de43-4394-8c1e-77cf71935ba7'
  );

commit;
