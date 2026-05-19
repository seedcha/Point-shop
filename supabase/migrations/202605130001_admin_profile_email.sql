alter table admin_profiles
add column if not exists email text;

create unique index if not exists admin_profiles_email_lower_key
on admin_profiles (lower(email))
where email is not null;
