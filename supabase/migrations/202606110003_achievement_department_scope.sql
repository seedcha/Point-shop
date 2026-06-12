begin;

alter table public.achievements
    add column if not exists department_id uuid;

alter table public.student_achievements
    add column if not exists department_id uuid;

alter table public.achievement_progress
    add column if not exists department_id uuid;

update public.student_achievements as student_achievement
set department_id = student.department_id
from public.students as student
where student.id = student_achievement.student_id
  and student_achievement.department_id is null;

update public.achievement_progress as progress
set department_id = student.department_id
from public.students as student
where student.id = progress.student_id
  and progress.department_id is null;

alter table public.achievements
    alter column department_id set not null;

alter table public.student_achievements
    alter column department_id set not null;

alter table public.achievement_progress
    alter column department_id set not null;

alter table public.achievements
    drop constraint if exists achievements_code_key;

alter table public.achievements
    add constraint achievements_department_code_key
        unique (department_id, code),
    add constraint achievements_id_department_key
        unique (id, department_id);

alter table public.students
    add constraint students_id_department_key
        unique (id, department_id);

alter table public.achievements
    add constraint achievements_department_id_fkey
    foreign key (department_id)
    references public.departments(id)
    on delete cascade;

alter table public.student_achievements
    drop constraint if exists student_achievements_student_id_fkey,
    drop constraint if exists student_achievements_achievement_id_fkey;

alter table public.student_achievements
    add constraint student_achievements_student_department_fkey
        foreign key (student_id, department_id)
        references public.students(id, department_id)
        on delete cascade,
    add constraint student_achievements_achievement_department_fkey
        foreign key (achievement_id, department_id)
        references public.achievements(id, department_id)
        on delete cascade;

alter table public.achievement_progress
    drop constraint if exists achievement_progress_student_id_fkey,
    drop constraint if exists achievement_progress_achievement_id_fkey;

alter table public.achievement_progress
    add constraint achievement_progress_student_department_fkey
        foreign key (student_id, department_id)
        references public.students(id, department_id)
        on delete cascade,
    add constraint achievement_progress_achievement_department_fkey
        foreign key (achievement_id, department_id)
        references public.achievements(id, department_id)
        on delete cascade;

alter table public.achievement_events
    drop constraint if exists achievement_events_student_id_fkey,
    drop constraint if exists achievement_events_achievement_id_fkey;

alter table public.achievement_events
    add constraint achievement_events_student_department_fkey
        foreign key (student_id, department_id)
        references public.students(id, department_id)
        on delete cascade,
    add constraint achievement_events_achievement_department_fkey
        foreign key (achievement_id, department_id)
        references public.achievements(id, department_id)
        on delete restrict;

alter table public.students
    drop constraint if exists students_selected_achievement_id_fkey;

alter table public.students
    add constraint students_selected_achievement_department_fkey
        foreign key (selected_achievement_id, department_id)
        references public.achievements(id, department_id)
        on delete restrict;

drop index if exists public.idx_achievements_active_sort;

create index if not exists idx_achievements_department_active_sort
    on public.achievements (department_id, is_active, category, sort_order);

create index if not exists idx_student_achievements_department_student
    on public.student_achievements (department_id, student_id, awarded_at desc);

create index if not exists idx_achievement_progress_department_student
    on public.achievement_progress (department_id, student_id, achievement_id);

commit;
