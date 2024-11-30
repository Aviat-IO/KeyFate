create or replace function check_in_secret(
    p_secret_id uuid,
    p_user_id uuid,
    p_checked_in_at timestamptz,
    p_next_check_in timestamptz
) returns void as $$
begin
    -- Update the secret
    update secrets
    set last_check_in = p_checked_in_at,
        next_check_in = p_next_check_in
    where id = p_secret_id
    and user_id = p_user_id;

    -- Record the check-in history
    insert into checkin_history (
        secret_id,
        user_id,
        checked_in_at,
        next_check_in
    ) values (
        p_secret_id,
        p_user_id,
        p_checked_in_at,
        p_next_check_in
    );
end;
$$ language plpgsql; 
