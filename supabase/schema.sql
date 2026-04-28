-- Supabase schema bootstrap file for the Point Shop project.

begin;

-- 1. extensions
create extension if not exists pgcrypto;

-- 2. 관리자 테이블
create table admin_profiles (
    id uuid primary key default gen_random_uuid(),
    manager_name varchar(50) not null,
    role varchar(20) not null default 'manager'
        check (role in ('master', 'manager')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. 관리자용 PIN 설정
create table admin_settings (
    setting_key varchar(50) primary key,
    value text not null,
    updated_by uuid references admin_profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 4. 학생 테이블
create table students (
    id uuid primary key default gen_random_uuid(),
    parent_phone varchar(20) not null,
    name varchar(50) not null,
    points int not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 5. 상품 테이블
create table products (
    id uuid primary key default gen_random_uuid(),
    name varchar(200) not null,
    description text,
    category varchar(50),
    price_dp int not null check (price_dp >= 0),
    stock int not null default 0 check (stock >= 0),
    is_active boolean not null default true,
    emoji varchar(10),
    image_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 6. 구매 내역
create table purchases (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    product_id uuid not null references products(id) on delete restrict,
    product_name varchar(200) not null,
    quantity int not null check (quantity > 0),
    dp_spent int not null check (dp_spent >= 0),
    created_at timestamptz not null default now()
);

-- 7. 포인트 이력
create table point_transactions (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    purchase_id uuid references purchases(id) on delete set null,
    amount int not null,
    balance_after int not null check (balance_after >= 0),
    reason varchar(255) not null,
    adjusted_by uuid references admin_profiles(id),
    created_at timestamptz not null default now()
);

-- 8. 출석 로그
create table attendance_logs (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    date date not null,
    status varchar(20) not null check (status in ('출석', '지각', '결석')),
    points_earned int not null default 0,
    created_at timestamptz not null default now(),
    unique (student_id, date)
);

-- 9. 공지사항
create table announcements (
    id uuid primary key default gen_random_uuid(),
    title varchar(200) not null,
    content text not null,
    created_at timestamptz not null default now()
);

-- 10. 시간표
create table timetable (
    id uuid primary key default gen_random_uuid(),
    class_name varchar(200) not null,
    day_of_week varchar(10) not null
        check (day_of_week in ('월', '화', '수', '목', '금', '토', '일')),
    start_time time not null,
    end_time time not null,
    student_counts int not null default 0 check (student_counts >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (class_name, day_of_week, start_time),
    check (start_time < end_time)
);

commit;