begin;

update students
set grade = '3세'
where grade is null or grade not in (
    '3세', '4세', '5세', '6세', '7세',
    '초1', '초2', '초3', '초4', '초5', '초6',
    '중1', '중2', '중3',
    '고1', '고2', '고3',
    '성인'
);

alter table students
drop constraint if exists students_grade_check;

alter table students
add constraint students_grade_check
check (grade in (
    '3세', '4세', '5세', '6세', '7세',
    '초1', '초2', '초3', '초4', '초5', '초6',
    '중1', '중2', '중3',
    '고1', '고2', '고3',
    '성인'
));

commit;
