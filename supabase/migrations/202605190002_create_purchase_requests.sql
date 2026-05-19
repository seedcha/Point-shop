create table purchase_requests (
    id uuid primary key default gen_random_uuid(),
    department_id uuid not null references departments(id) on delete cascade,
    student_id uuid not null references students(id) on delete cascade,
    product_id uuid not null references products(id) on delete restrict,
    quantity int not null check (quantity > 0),
    status varchar(20) not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
    handled_by uuid references admin_profiles(id) on delete set null,
    handled_at timestamptz,
    reject_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_purchase_requests_department_status
on purchase_requests(department_id, status, created_at desc);

create index idx_purchase_requests_student
on purchase_requests(student_id);

create index idx_purchase_requests_product
on purchase_requests(product_id);
