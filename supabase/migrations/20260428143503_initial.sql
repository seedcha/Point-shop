begin;

alter table students
add column if not exists department_id uuid references departments(id) on delete restrict;

alter table students
add column if not exists teacher_id uuid references admin_profiles(id) on delete set null;

alter table point_transactions
add column if not exists department_id uuid references departments(id) on delete restrict;

-- 기존 데이터 백필: 현재 seed/master 가맹점 기준. 필요하면 '판교'를 실제 기본 가맹점으로 바꾸세요.
update students
set department_id = (select id from departments where name = '판교')
where department_id is null;

update point_transactions pt
set department_id = s.department_id
from students s
where pt.student_id = s.id
and pt.department_id is null;

alter table students
alter column department_id set not null;

create index if not exists idx_students_department_id
on students(department_id);

create index if not exists idx_students_teacher_id
on students(teacher_id);

create index if not exists idx_point_transactions_department_id
on point_transactions(department_id);

create index if not exists idx_point_transactions_department_type
on point_transactions(department_id, transaction_type);

create index if not exists idx_point_transactions_adjusted_by
on point_transactions(adjusted_by);

commit;
