drop index if exists admin_profiles_email_lower_key;

alter table admin_profiles
drop column if exists email;
