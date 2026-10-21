-- Handoff H-BS7-STANCE (Business Session 7), file 2 of 2: the Bridge row and 1859's order.
-- Applied after 20261021170000 has committed, because 'bridge' is unusable in the transaction that
-- added it (see that file's header).
--
-- Outcome: public.member_stances holds six rows whose position reads, from 1: kin, returnee, bridge,
-- anchor, ally, exploring (1859); the label for bridge is Bridge (1856). The order is rewritten here
-- and nowhere else: every surface reads it through vocabularies() and connect_filter_options() in
-- position order (187), so no component changes for it.
--
-- member_stances_position_key is UNIQUE (position), read from the live catalog as the handoff asked,
-- so the rewrite shifts every row clear of 1 to 6 first, as 20260911052909 did, and then sets each
-- final value into a free slot. No member row is touched: members.stance keeps its default of
-- 'exploring' and no update reaches public.members, so private.stance_declared fires for nobody.
--
-- The live catalog holds no CHECK, policy, view or trigger that enumerates stance values, and the
-- one function that does, public.save_profile_section, enumerates them to route per-variant fields
-- (returnee, anchor, ally) and gates nothing on the value set; Bridge carries no per-variant fields
-- (H-BS7-STANCE names none), so it needs no change. onboard_relationship takes public.stance and
-- admits the new value by the type.
update public.member_stances set position = position + 10;
insert into public.member_stances (stance, label, position) values ('bridge', 'Bridge', 3);
update public.member_stances set position = 1 where stance = 'kin';
update public.member_stances set position = 2 where stance = 'returnee';
update public.member_stances set position = 4 where stance = 'anchor';
update public.member_stances set position = 5 where stance = 'ally';
update public.member_stances set position = 6 where stance = 'exploring';

do $$
declare
  v_order text;
begin
  select string_agg(stance::text || ':' || label || '@' || position, ',' order by position)
    into v_order
    from public.member_stances;
  if v_order <> 'kin:Kin@1,returnee:Returnee@2,bridge:Bridge@3,anchor:Anchor@4,ally:Ally@5,exploring:Still exploring@6' then
    raise exception 'member_stances is not in ruling 1859''s order: %', v_order;
  end if;
  if (select count(*) from public.members where stance = 'bridge') <> 0 then
    raise exception 'no member row may change stance in this migration';
  end if;
end $$;
