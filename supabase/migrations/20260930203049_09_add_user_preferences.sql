alter table public.user_roles
add column notif_alerts_enabled boolean not null default true,
add column notif_sec_enabled boolean not null default false,
add column notif_email text;

create policy "Users can update their own preferences" on public.user_roles
for update
to authenticated
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );
