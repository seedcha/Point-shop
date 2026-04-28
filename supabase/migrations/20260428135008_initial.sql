begin;

alter table students
add column if not exists department_id uuid;

update students
set department_id = (
    select id from departments where name = '대치'
)
where department_id is null;

alter table students
alter column department_id set not null;

alter table students
drop constraint if exists students_department_id_fkey;

alter table students
add constraint students_department_id_fkey
foreign key (department_id) references departments(id) on delete restrict;

create index if not exists idx_students_department_id
on students(department_id);

commit;
