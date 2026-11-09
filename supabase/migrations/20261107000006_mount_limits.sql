-- =====================================================================
-- UNTSF-COMM: what a TSF's weapon mounts can carry, by type and generation.
--   Tactical surface attackers, heavy assault and long range support
--   are unchanged. Types not named here are left alone.
--     assault           heavy weapons on the back arms only
--     general purpose   heavy weapons on the left back arm only
--     close combat      no heavy weapons, but keeps heavy melee
--     interceptor, reconnaissance, electronic warfare, training
--                       no heavy weapons, medium weight at most
--   3rd and quasi-3rd generation frames: the right back arm takes no
--   heavy weapons and medium weight at most.
--   F-22A and F-15SE: no heavy weapons, medium weight at most (stealth).
--
--   This only ever tightens a mount, and it is safe to run twice. A
--   change that would block a variant's own factory fit, or leave a
--   mount accepting nothing, is skipped and reported with a notice.
--   Approved configurations keep their frozen statistics.
-- =====================================================================

do $$
declare
    open_mounts   constant text[] := array['R_HAND', 'L_HAND', 'BACK_L', 'BACK_R', 'SHOULDER_L', 'SHOULDER_R'];
    light_roles   constant text[] := array['interceptor', 'reconnaissance', 'electronic_warfare', 'training'];
    limited_roles constant text[] := array['assault', 'general_purpose', 'close_combat', 'interceptor', 'reconnaissance', 'electronic_warfare', 'training'];
    weights       constant text[] := array['light', 'medium', 'heavy'];
    rec        record;
    h          jsonb;
    eq         jsonb;
    new_hps    jsonb;
    new_slots  jsonb;
    code       text;
    eq_id      text;
    new_weight text;
    tsf_role   text;
    tsf_gen    text;
    keep_heavy boolean;
    cap        boolean;
    fit_before boolean;
    fit_after  boolean;
    changed    integer := 0;
    skipped    integer := 0;
begin
    for rec in
        select v.id, v.data as v, m.data as m
        from public.docs v
        left join public.docs m on m.collection = 'models' and m.id = v.data ->> 'modelId'
        where v.collection = 'variants' and jsonb_typeof(v.data -> 'hardpoints') = 'array'
    loop
        tsf_role := coalesce(nullif(rec.v ->> 'classificationId', ''), nullif(rec.m ->> 'classificationId', ''));
        tsf_gen  := coalesce(nullif(rec.v ->> 'generationId', ''), nullif(rec.m ->> 'generationId', ''));
        if tsf_role is null then
            raise notice 'Mount limits: % left alone, it has no classification.', rec.id;
            continue;
        end if;
        if not (tsf_role = any (limited_roles)) then
            continue;
        end if;

        new_hps := '[]'::jsonb;
        for h in select e.value from jsonb_array_elements(rec.v -> 'hardpoints') with ordinality e order by e.ordinality loop
            code := h ->> 'code';
            if not (code = any (open_mounts)) or jsonb_typeof(h -> 'slots') <> 'array' then
                new_hps := new_hps || jsonb_build_array(h);
                continue;
            end if;

            keep_heavy := (tsf_role = 'assault' and code not like '%_HAND') or (tsf_role = 'general_purpose' and code = 'BACK_L');
            cap := tsf_role = any (light_roles)
                or rec.v ->> 'modelId' = any (array['mdl-raptor', 'mdl-f15se'])
                or (coalesce(tsf_gen, '') = any (array['3', 'q3']) and code = 'BACK_R');
            if cap then keep_heavy := false; end if;

            new_slots := h -> 'slots';
            if not keep_heavy then
                new_slots := new_slots - 'heavy';
            end if;
            new_weight := case when cap and h ->> 'maxWeight' = 'heavy' then 'medium' else h ->> 'maxWeight' end;

            if new_slots = '[]'::jsonb and h -> 'slots' <> '[]'::jsonb then
                raise notice 'Mount limits: % % kept as it was, the limit would leave it accepting nothing.', rec.id, code;
                skipped := skipped + 1;
                new_hps := new_hps || jsonb_build_array(h);
                continue;
            end if;

            eq_id := rec.v -> 'defaultLoadout' ->> code;
            eq := null;
            if eq_id is not null then
                select d.data into eq from public.docs d where d.collection = 'equipment' and d.id = eq_id;
            end if;
            if eq is not null then
                fit_before := exists (select 1 from jsonb_array_elements_text(h -> 'slots') s where eq -> 'slots' ? s)
                    and array_position(weights, eq ->> 'weight') <= array_position(weights, h ->> 'maxWeight');
                fit_after := exists (select 1 from jsonb_array_elements_text(new_slots) s where eq -> 'slots' ? s)
                    and array_position(weights, eq ->> 'weight') <= array_position(weights, new_weight);
                if fit_before and not fit_after then
                    raise notice 'Mount limits: % % kept as it was, the limit would block its factory fit (%).', rec.id, code, eq ->> 'name';
                    skipped := skipped + 1;
                    new_hps := new_hps || jsonb_build_array(h);
                    continue;
                end if;
            end if;

            new_hps := new_hps || jsonb_build_array(h || jsonb_build_object('slots', new_slots, 'maxWeight', new_weight));
        end loop;

        if new_hps <> rec.v -> 'hardpoints' then
            update public.docs set data = jsonb_set(data, '{hardpoints}', new_hps) where collection = 'variants' and id = rec.id;
            changed := changed + 1;
        end if;
    end loop;
    raise notice 'Mount limits: % variants tightened, % mounts skipped.', changed, skipped;
end $$;
