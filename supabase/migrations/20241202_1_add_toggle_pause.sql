create or replace function toggle_secret_pause(
    p_secret_id uuid,
    p_user_id uuid,
    p_new_status text,
    p_checked_in_at timestamptz,
    p_next_check_in timestamptz
) returns void as $$
begin
    -- Update the secret status
    update secrets
    set status = p_new_status::secret_status,
        last_check_in = p_checked_in_at,
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

-- Secure the function
alter function toggle_secret_pause(
    p_secret_id uuid,
    p_user_id uuid,
    p_new_status text,
    p_checked_in_at timestamptz,
    p_next_check_in timestamptz
)
    set search_path = '$user', 'public', 'extensions'; 
