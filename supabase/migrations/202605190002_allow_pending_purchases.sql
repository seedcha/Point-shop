begin;

alter table purchases
    drop constraint if exists purchases_status_check;

alter table purchases
    add constraint purchases_status_check
    check (status in ('pending', 'completed', 'cancelled', 'refunded'));

commit;
