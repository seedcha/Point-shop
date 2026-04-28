-- Supabase schema bootstrap file for the Point Shop project.

begin;

-- extensions
create extension if not exists pgcrypto;

-- department 테이블
create table departments (
    id uuid primary key default gen_random_uuid(), -- 부서 ID
    name varchar(50) not null unique, -- 부서 이름
    is_active boolean not null default true, -- 부서 활성 여부
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간
);

-- 관리자 테이블
create table admin_profiles (
    id uuid primary key default gen_random_uuid(), -- 관리자 ID
    login_id varchar(50) not null unique, -- 로그인 시 사용하는 ID
    manager_name varchar(50) not null, -- 관리자 이름
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    role varchar(20) not null default 'manager'
        check (role in ('master', 'manager')), -- 관리자 역할 (마스터 또는 매니저)
    department_id uuid not null references departments(id) on delete restrict, -- 관리자 부서/소속
    is_active boolean not null default true, -- 관리자 활성 여부
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간
);

-- 관리자용 PIN 설정
create table admin_settings (
    setting_key varchar(50) primary key, -- 설정 키
    value text not null, -- 설정 값(PIN은 bcrypt 해시로 저장)
    updated_by uuid references admin_profiles(id), -- 설정 변경자
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간
);

-- 시간표
create table timetable (
    id uuid primary key default gen_random_uuid(), -- 시간표 ID
    department_id uuid not null references departments(id) on delete restrict,
    class_name varchar(200) not null, -- 수업 이름
    day_of_week varchar(10) not null
        check (day_of_week in ('월', '화', '수', '목', '금', '토', '일')), -- 요일
    start_time time not null, -- 수업 시작 시간
    end_time time not null, -- 수업 종료 시간
    is_active boolean not null default true, -- 시간표 활성 여부
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now(), -- 업데이트 시간
    unique (department_id, class_name, day_of_week, start_time), -- 강의명, 요일, 시작 시간 조합 중복 방지
    check (start_time < end_time) -- 종료 시간이 시작 시간보다 늦어야 함
);

-- 학생 테이블
create table students (
    id uuid primary key default gen_random_uuid(), -- 학생 ID
    parent_phone varchar(20) not null, -- 학부모 전화번호
    name varchar(50) not null, -- 학생 이름
    points int not null default 0, -- 학생이 보유한 포인트
    is_active boolean not null default true, -- 학생 활성 여부
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간
);

-- 학생과 수업 간의 다대다 관계 테이블
create table student_classes (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    class_id uuid not null references timetable(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (student_id, class_id)
);

-- 상품 테이블
create table products (
    id uuid primary key default gen_random_uuid(), -- 상품 ID
    department_id uuid not null references departments(id) on delete cascade, -- 상품 소속 부서
    name varchar(200) not null, -- 상품 이름
    description text, -- 상품 설명
    category varchar(50), -- 상품 카테고리
    price_dp int not null check (price_dp >= 0), -- 상품 가격 (포인트 단위)
    stock int not null default 0 check (stock >= 0), -- 상품 재고
    is_active boolean not null default true, -- 상품 활성 여부
    emoji varchar(10), -- 상품 이모지
    image_url text, -- 상품 이미지 URL
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간
);

-- 구매 내역
create table purchases (
    id uuid primary key default gen_random_uuid(), -- 구매 ID
    student_id uuid not null references students(id) on delete cascade, -- 학생 ID
    product_id uuid not null references products(id) on delete restrict, -- 상품 ID
    product_name varchar(200) not null, -- 구매 당시 상품 이름
    quantity int not null check (quantity > 0), -- 구매 수량
    dp_spent int not null check (dp_spent >= 0), -- 총 사용 포인트
    status varchar(20) not null default 'completed'
        check (status in ('completed', 'cancelled', 'refunded')), -- 구매 상태
    created_at timestamptz not null default now() -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간(구매 취소 등)
);

-- 포인트 이력
create table point_transactions (
    id uuid primary key default gen_random_uuid(), -- 포인트 이력 ID
    student_id uuid not null references students(id) on delete cascade, -- 학생 ID
    purchase_id uuid references purchases(id) on delete set null, -- 연결된 구매 ID
    amount int not null, -- 포인트 변화량 (증가: 양수, 감소: 음수)
    balance_after int not null check (balance_after >= 0), -- 거래 후 학생 보유 포인트
    transaction_type varchar(30) not null
        check (transaction_type in ('attendance', 'purchase', 'refund', 'etc')), -- 포인트 변동 유형
    reason varchar(255) not null, -- 포인트 변화 이유
    adjusted_by uuid references admin_profiles(id), -- 포인트 조정자
    created_at timestamptz not null default now() -- 생성 시간
);

-- 출석 로그
create table attendance_logs (
    id uuid primary key default gen_random_uuid(), -- 출석 로그 ID
    student_id uuid not null references students(id) on delete cascade, -- 학생 ID
    class_id uuid not null references timetable(id) on delete cascade, -- 수업 ID
    date date not null, -- 출석 날짜
    status varchar(20) not null check (status in ('출석', '지각', '결석')), -- 출석 상태
    dp_earned int not null default 0, -- 출석으로 얻은 포인트
    created_at timestamptz not null default now(), -- 생성 시간
    unique (student_id, class_id, date) -- 중복 출석 방지
);

-- 공지사항
create table announcements (
    id uuid primary key default gen_random_uuid(), -- 공지 ID
    title varchar(200) not null, -- 공지 제목
    content text not null, -- 공지 내용
    created_at timestamptz not null default now() -- 생성 시간
);

-- indexes for performance optimization
-- 관리자가 로그인했을 때 자기 부서 기준 조회
create index idx_admin_profiles_department_id
on admin_profiles(department_id);

-- 부서별 시간표 조회
create index idx_timetable_department_id
on timetable(department_id);

-- 수업 클릭 시 해당 학생 목록 조회
create index idx_student_classes_class_id
on student_classes(class_id);

-- 학생 상세에서 학생이 듣는 수업 조회
create index idx_student_classes_student_id
on student_classes(student_id);

-- 부서별 상품 필터링
create index idx_products_department_id
on products(department_id);

-- 학생별 포인트 이력 조회
create index idx_point_transactions_student_id
on point_transactions(student_id);

-- Initial data seeding
insert into departments (name) values
('대치'), ('판교')
on conflict (name) do nothing;

insert into admin_profiles (manager_name, login_id, auth_user_id, role, department_id) values
('차윤빈', 'seed', '80c6855b-2b45-4f8b-be7f-1e6b0b8b30e5', 'master', (select id from departments where name = '판교'))
on conflict (auth_user_id) do nothing;

commit;