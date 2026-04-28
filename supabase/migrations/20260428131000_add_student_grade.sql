begin;

alter table students
add column if not exists grade varchar(20);

update students
set grade = '미지정'
where grade is null;

alter table students
alter column grade set not null;

commit;
