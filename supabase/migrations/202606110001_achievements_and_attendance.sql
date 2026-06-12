begin;

create table if not exists public.class_sessions (
    id uuid primary key default gen_random_uuid(),
    timetable_id uuid not null
        references public.timetable(id) on delete cascade,
    department_id uuid not null
        references public.departments(id) on delete cascade,
    session_date date not null,
    scheduled_start_at timestamptz not null,
    scheduled_end_at timestamptz not null,
    status text not null default 'scheduled'
        check (status in ('scheduled', 'completed', 'cancelled')),
    note text,
    created_by uuid
        references public.admin_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint class_sessions_time_check
        check (scheduled_end_at > scheduled_start_at),
    constraint class_sessions_timetable_date_key
        unique (timetable_id, session_date)
);

alter table public.attendance_logs
    add column if not exists session_id uuid
        references public.class_sessions(id) on delete set null,
    add column if not exists checked_in_at timestamptz,
    add column if not exists recorded_by uuid
        references public.admin_profiles(id) on delete set null,
    add column if not exists note text,
    add column if not exists updated_at timestamptz not null default now();

create table if not exists public.achievements (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    category text not null
        check (category in ('attendance', 'inquiry', 'competition', 'general')),
    rarity text not null
        check (rarity in ('common', 'rare', 'heroic', 'legendary', 'mythic')),
    description text not null,
    condition_type text not null,
    condition_value integer
        check (condition_value is null or condition_value >= 0),
    condition_unit text,
    condition_config jsonb not null default '{}'::jsonb,
    is_automatic boolean not null default false,
    is_active boolean not null default true,
    sort_order integer not null default 0
        check (sort_order >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint achievements_code_check
        check (char_length(trim(code)) > 0),
    constraint achievements_name_check
        check (char_length(trim(name)) > 0)
);

create table if not exists public.student_achievements (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null
        references public.students(id) on delete cascade,
    achievement_id uuid not null
        references public.achievements(id) on delete cascade,
    awarded_by uuid
        references public.admin_profiles(id) on delete set null,
    award_source text not null default 'automatic'
        check (award_source in ('automatic', 'manual', 'imported')),
    award_note text,
    awarded_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint student_achievements_student_achievement_key
        unique (student_id, achievement_id)
);

create table if not exists public.achievement_progress (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null
        references public.students(id) on delete cascade,
    achievement_id uuid not null
        references public.achievements(id) on delete cascade,
    current_value integer not null default 0
        check (current_value >= 0),
    streak_value integer not null default 0
        check (streak_value >= 0),
    period_started_at timestamptz,
    period_ended_at timestamptz,
    progress_data jsonb not null default '{}'::jsonb,
    last_evaluated_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint achievement_progress_student_achievement_key
        unique (student_id, achievement_id),
    constraint achievement_progress_period_check
        check (
            period_ended_at is null
            or period_started_at is null
            or period_ended_at >= period_started_at
        )
);

create table if not exists public.achievement_events (
    id uuid primary key default gen_random_uuid(),
    department_id uuid not null
        references public.departments(id) on delete cascade,
    student_id uuid not null
        references public.students(id) on delete cascade,
    achievement_id uuid
        references public.achievements(id) on delete set null,
    event_type text not null,
    event_value integer not null default 1,
    event_data jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    recorded_by uuid
        references public.admin_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint achievement_events_type_check
        check (char_length(trim(event_type)) > 0)
);

alter table public.students
    add column if not exists selected_achievement_id uuid
        references public.achievements(id) on delete set null;

create index if not exists idx_class_sessions_department_date
    on public.class_sessions (department_id, session_date, status);

create index if not exists idx_attendance_logs_student_date
    on public.attendance_logs (student_id, date desc);

create index if not exists idx_attendance_logs_session
    on public.attendance_logs (session_id);

create index if not exists idx_attendance_logs_checked_in
    on public.attendance_logs (student_id, checked_in_at);

create index if not exists idx_achievements_active_sort
    on public.achievements (is_active, category, sort_order);

create index if not exists idx_student_achievements_student_awarded
    on public.student_achievements (student_id, awarded_at desc);

create index if not exists idx_achievement_progress_student
    on public.achievement_progress (student_id, achievement_id);

create index if not exists idx_achievement_events_student_occurred
    on public.achievement_events (student_id, occurred_at desc);

create index if not exists idx_achievement_events_department_type
    on public.achievement_events (department_id, event_type, occurred_at desc);

commit;
