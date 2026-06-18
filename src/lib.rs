const NUMBERS: &'static [f32] = &[
    0.0,
    0.0, 0.0, 0.0, 0.0, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05,
    0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26, 0.29, 0.32, 0.35,
    0.38, 0.41, 0.44, 0.47, 0.5, 0.514, 0.528, 0.542, 0.556, 0.57,
    0.584, 0.598, 0.612, 0.626, 0.64, 0.654, 0.668, 0.682, 0.696, 0.71,
    0.724, 0.738, 0.752, 0.766, 0.78, 0.794, 0.808, 0.822, 0.836, 0.85,
    0.853, 0.856, 0.859, 0.862, 0.865, 0.868, 0.871, 0.874, 0.878, 0.881,
    0.884, 0.887, 0.89, 0.893, 0.896, 0.899, 0.902, 0.905, 0.908, 0.911,
    0.914, 0.917, 0.92, 0.923, 0.927, 0.93, 0.933, 0.936, 0.939, 0.942,
    0.945, 0.948, 0.951, 0.954, 0.957, 0.96, 0.963, 0.966, 0.969, 0.972,
    0.975, 0.979, 0.982, 0.98, 0.988, 0.991, 0.994, 0.997, 1.0,
];
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WeaponType {
    Dual,
    Conv,
    Blood,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GemShape {
    Radial,
    Triangle,
    Waning,
    Circle,
}

#[derive(Debug, Clone)]
pub struct Weapon {
    pub name: String,
    pub weapon_type: WeaponType,
    pub phys: u16,
    pub blood: u16,
    pub arcane: u16,
    pub fire: u16,
    pub bolt: u16,
    str_scale: f32,
    skl_scale: f32,
    blt_scale: f32,
    arc_scale: f32,
    serrated: f32,
    righteous: f32,
    serrated_tricked: f32,
    righteous_tricked: f32,
}

#[derive(Debug, Clone)]
pub struct Gem {
    pub name: String,
    pub source: String,
    pub tier: u8,
    pub shape: GemShape,
    pub arc_scale: f32,
    pub str_scale: f32,
    pub dmg_general: f32,
    pub dmg_arcane: f32,
    pub dmg_fire: f32,
    pub dmg_bolt: f32,
    pub dmg_phys: f32,
    pub dmg_blood: f32,
    pub dmg_blunt: f32,
    pub dmg_thrust: f32,
    pub flat_phys: f32,
    pub flat_arcane: f32,
    pub flat_fire: f32,
    pub flat_bolt: f32,
    pub flat_blood: f32,
    pub open_foes: f32,
    pub striking: f32,
    pub kinhunter: f32,
    pub beasthunter: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConvertedElement {
    Phys,
    Bolt,
    Fire,
    Arc,
}

pub struct Stats {
    pub str: u16,
    pub skl: u16,
    pub blt: u16,
    pub arc: u16,
}

#[derive(Debug, Clone)]
pub struct ArBreakdown {
    pub total: f32,
    pub physical: f32,
    pub blunt: f32,
    pub thrust: f32,
    pub arcane: f32,
    pub fire: f32,
    pub bolt: f32,
    pub blood: f32,
    pub converted_element: ConvertedElement,
}

pub fn gem_sum(gems: &[Option<&Gem>]) -> f32 {
    gems.iter().map(|g| g.as_ref().map(|g| g.dmg_general)).sum::<Option<f32>>().unwrap_or(0.0)
}

fn get_sat(stat: u16) -> f32 {
    if (stat as usize) >= NUMBERS.len() {
        return 1.0;
    }
    NUMBERS[stat as usize]
}

pub fn compute_ar(weapon: &Weapon, gems: [Option<&Gem>; 3], stats: &Stats) -> ArBreakdown {
    let sum = |f: fn(&Gem) -> f32| gems.iter().flatten().copied().map(f).sum::<f32>();
    let prod = |f: fn(&Gem) -> f32| gems.iter().flatten().copied().map(f).product::<f32>();

    let arc_scale_sum = sum(|g| g.arc_scale);
    let str_scale_sum = sum(|g| g.str_scale);
    let dmg = prod(|g| g.dmg_general);
    let phys_mult = prod(|g| g.dmg_phys);
    let arc_mult = prod(|g| g.dmg_arcane);
    let fire_mult = prod(|g| g.dmg_fire);
    let bolt_mult = prod(|g| g.dmg_bolt);
    let blood_mult = prod(|g| g.dmg_blood);
    let blunt_mult = prod(|g| g.dmg_blunt);
    let thrust_mult = prod(|g| g.dmg_thrust);
    let flat_phys = sum(|g| g.flat_phys);
    let flat_arc_gems = sum(|g| g.flat_arcane);
    let flat_fire = sum(|g| g.flat_fire);
    let flat_bolt = sum(|g| g.flat_bolt);
    let flat_blood = sum(|g| g.flat_blood);

    let sat_str = get_sat(stats.str);
    let sat_skl = get_sat(stats.skl);
    let sat_blt = get_sat(stats.blt);
    let sat_arc = get_sat(stats.arc);

    // --- Weapon-specific special cases
    let tricked = weapon.name == "Logarius' Wheel (Tricked)";
    let dg_bolt = if weapon.name == "Tonitrus (Tricked)" { 1.7 } else { 1.0 };
    let (dh_phys, di_arc, flat_arc_mod) = if tricked {(0.7, 3.0, 20.0)} else { (1.0, 1.0, 0.0) };
    let flat_arc = flat_arc_gems + flat_arc_mod;

    // --- Conversion element for "Conv" weapons (sheet AE).
    // Priority via weighted flags (Arc > Fire > Bolt) so multi-element gem sets
    // resolve to the dominant element rather than collapsing to Phys.
    let arc_flag = if arc_mult > 1.0 || flat_arc_gems > 0.0 { 100 } else { 0 };
    let fire_flag = if fire_mult > 1.0 || flat_fire > 0.0 { 10 } else { 0 };
    let bolt_flag = if bolt_mult > 1.0 || flat_bolt > 0.0 { 1 } else { 0 };
    let ai = arc_flag + fire_flag + bolt_flag;
    let converted_element = if ai < 1 {
        ConvertedElement::Phys
    } else if ai < 10 {
        ConvertedElement::Bolt
    } else if ai < 100 {
        ConvertedElement::Fire
    } else {
        ConvertedElement::Arc
    };

    let is_dual = weapon.weapon_type == WeaponType::Dual;
    let is_conv = weapon.weapon_type == WeaponType::Conv;

    // base = P * (1 + (weaponStrScale + gemStrScale)*sat(Str) + weaponSklScale*sat(Skl))
    let phys_base = |p: f32| {
        p + (p * (weapon.str_scale + str_scale_sum) * sat_str + p * weapon.skl_scale * sat_skl)
    };
    // base = E * (1 + (weaponArcScale + gemArcScale)*sat(Arc))
    let elem_base = |e: f32| e + e * (weapon.arc_scale + arc_scale_sum) * sat_arc;

    let phys_converted = is_conv && converted_element != ConvertedElement::Phys;

    // --- Physical / Blunt / Thrust
    let phys_core = phys_base(weapon.phys as f32) * phys_mult * dmg * dh_phys;
    let physical = if phys_converted {
        flat_phys.floor()
    } else {
        (phys_core + flat_phys).floor()
    };
    let blunt = if phys_converted {
        flat_phys.floor()
    } else {
        (phys_core * blunt_mult + flat_phys).floor()
    };
    let thrust = if phys_converted {
        flat_phys.floor()
    } else {
        (phys_core * thrust_mult + flat_phys).floor()
    };

    // --- Arcane
    let arcane = if is_conv && converted_element == ConvertedElement::Arc {
        (elem_base(weapon.phys as f32) * arc_mult * dmg * di_arc + flat_arc).floor()
    } else if is_dual {
        (elem_base(weapon.arcane as f32) * arc_mult * dmg * di_arc + flat_arc).floor()
    } else {
        flat_arc.floor()
    };

    // --- Fire
    let fire = if is_conv && converted_element == ConvertedElement::Fire {
        (elem_base(weapon.phys as f32) * fire_mult * dmg + flat_fire).floor()
    } else if weapon.name == "Boom Hammer" {
        (elem_base(weapon.fire as f32) * fire_mult * dmg + flat_fire).floor()
    } else {
        flat_fire.floor()
    };

    // --- Bolt (non-bolt weapons have bolt base 0 -> collapses to flat bolt; Tonitrus scales)
    let bolt = if is_conv && converted_element == ConvertedElement::Bolt {
        (elem_base(weapon.phys as f32) * bolt_mult * dmg * dg_bolt + flat_bolt).floor()
    } else {
        (elem_base(weapon.bolt as f32) * bolt_mult * dmg * dg_bolt + flat_bolt).floor()
    };

    // --- Blood (adds flat-physical + flat-blood gem bonuses per the sheet)
    let blood = ((weapon.blood as f32 + weapon.blood as f32 * weapon.blt_scale * sat_blt)
        * phys_mult
        * blood_mult
        * dmg
        + flat_phys
        + flat_blood)
        .floor();

    // --- Total: SUM for "Dual" weapons, else MAX dominant element
    let total = if is_dual {
        physical + arcane + fire + bolt + blood
    } else {
        [arcane, fire, bolt, blood]
            .iter()
            .fold(physical, |acc, &x| acc.max(x))
    };

    ArBreakdown {
        total,
        physical,
        blunt,
        thrust,
        arcane,
        fire,
        bolt,
        blood,
        converted_element,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A weapon with no scaling and no base damage; tests override what they need.
    fn weapon(name: &str, weapon_type: WeaponType) -> Weapon {
        Weapon {
            name: name.to_string(),
            weapon_type,
            phys: 0,
            blood: 0,
            arcane: 0,
            fire: 0,
            bolt: 0,
            str_scale: 0.0,
            skl_scale: 0.0,
            blt_scale: 0.0,
            arc_scale: 0.0,
            serrated: 0.0,
            righteous: 0.0,
            serrated_tricked: 0.0,
            righteous_tricked: 0.0,
        }
    }

    /// An identity gem: scales/flats are 0, every multiplier is 1 (no effect).
    fn gem() -> Gem {
        Gem {
            name: "test".to_string(),
            source: "test".to_string(),
            tier: 0,
            shape: GemShape::Radial,
            arc_scale: 0.0,
            str_scale: 0.0,
            dmg_general: 1.0,
            dmg_arcane: 1.0,
            dmg_fire: 1.0,
            dmg_bolt: 1.0,
            dmg_phys: 1.0,
            dmg_blood: 1.0,
            dmg_blunt: 1.0,
            dmg_thrust: 1.0,
            flat_phys: 0.0,
            flat_arcane: 0.0,
            flat_fire: 0.0,
            flat_bolt: 0.0,
            flat_blood: 0.0,
            open_foes: 1.0,
            striking: 1.0,
            kinhunter: 1.0,
            beasthunter: 1.0,
        }
    }

    const ZERO_STATS: Stats = Stats {
        str: 0,
        skl: 0,
        blt: 0,
        arc: 0,
    };

    #[test]
    fn dual_no_gems_sums_physical_and_elements() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;
        w.arcane = 50;

        let ar = compute_ar(&w, [None, None, None], &ZERO_STATS);

        // No scaling (stats 0), identity gems: phys=100, arcane=50, rest 0.
        assert_eq!(ar.physical, 100.0);
        assert_eq!(ar.blunt, 100.0);
        assert_eq!(ar.thrust, 100.0);
        assert_eq!(ar.arcane, 50.0);
        assert_eq!(ar.fire, 0.0);
        assert_eq!(ar.bolt, 0.0);
        assert_eq!(ar.blood, 0.0);
        // Dual total is the sum of physical + all elements.
        assert_eq!(ar.total, 150.0);
        assert_eq!(ar.converted_element, ConvertedElement::Phys);
    }

    #[test]
    fn str_scaling_uses_saturation_table() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;
        w.str_scale = 0.2;
        let stats = Stats {
            str: 25, // saturation = 0.5
            skl: 0,
            blt: 0,
            arc: 0,
        };

        let ar = compute_ar(&w, [None, None, None], &stats);

        // physBase = 100 + 100 * 0.2 * 0.5 = 110
        assert_eq!(ar.physical, 110.0);
    }

    #[test]
    fn gems_aggregate_sum_and_product() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;

        let mut g1 = gem();
        g1.dmg_general = 2.0;
        g1.flat_phys = 10.0;
        let mut g2 = gem();
        g2.dmg_general = 1.5;
        g2.flat_phys = 5.0;

        let ar = compute_ar(&w, [Some(&g1), Some(&g2), None], &ZERO_STATS);

        // gen = 2.0 * 1.5 = 3.0; flat_phys = 10 + 5 = 15
        // physCore = 100 * 3.0 = 300; physical = floor(300 + 15) = 315
        assert_eq!(ar.physical, 315.0);
    }

    #[test]
    fn conv_weapon_converts_physical_to_element() {
        let mut w = weapon("Test Cannon", WeaponType::Conv);
        w.phys = 100;

        let mut g = gem();
        g.dmg_fire = 1.5;

        let ar = compute_ar(&w, [Some(&g), None, None], &ZERO_STATS);

        assert_eq!(ar.converted_element, ConvertedElement::Fire);
        // Physical line collapses to flat physical (0) once converted.
        assert_eq!(ar.physical, 0.0);
        // fire = floor(elemBase(100) * 1.5) = 150
        assert_eq!(ar.fire, 150.0);
        // Non-dual total is the max line.
        assert_eq!(ar.total, 150.0);
    }

    #[test]
    fn converted_element_priority_is_arc_over_fire_over_bolt() {
        let w = weapon("Test Cannon", WeaponType::Conv);

        let mut g = gem();
        g.dmg_arcane = 1.5;
        g.dmg_fire = 1.5;
        g.dmg_bolt = 1.5;

        let ar = compute_ar(&w, [Some(&g), None, None], &ZERO_STATS);

        // All three flags set -> arcane wins.
        assert_eq!(ar.converted_element, ConvertedElement::Arc);
    }

    #[test]
    fn logarius_wheel_tricked_applies_modifiers() {
        let mut w = weapon("Logarius' Wheel (Tricked)", WeaponType::Dual);
        w.phys = 100;
        w.arcane = 10;

        let ar = compute_ar(&w, [None, None, None], &ZERO_STATS);

        // dhPhys = 0.7 -> physical = floor(100 * 0.7) = 70
        assert_eq!(ar.physical, 70.0);
        // diArc = 3, flatArc += 20 -> arcane = floor(10 * 3 + 20) = 50
        assert_eq!(ar.arcane, 50.0);
        assert_eq!(ar.total, 120.0);
    }

    #[test]
    fn tonitrus_tricked_scales_bolt() {
        let mut w = weapon("Tonitrus (Tricked)", WeaponType::Dual);
        w.bolt = 100;

        let ar = compute_ar(&w, [None, None, None], &ZERO_STATS);

        // dgBolt = 1.7 -> bolt = floor(100 * 1.7) = 170
        assert_eq!(ar.bolt, 170.0);
    }

    #[test]
    fn boom_hammer_scales_fire_off_weapon_fire() {
        let mut w = weapon("Boom Hammer", WeaponType::Dual);
        w.fire = 80;

        let ar = compute_ar(&w, [None, None, None], &ZERO_STATS);

        // Boom Hammer routes weapon.fire through the elemental line.
        assert_eq!(ar.fire, 80.0);
    }

    #[test]
    fn blood_line_adds_flat_phys_and_flat_blood() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.blood = 100;

        let mut g = gem();
        g.flat_phys = 10.0;
        g.flat_blood = 5.0;

        let ar = compute_ar(&w, [Some(&g), None, None], &ZERO_STATS);

        // blood = floor(100 * 1 * 1 * 1 + flatPhys(10) + flatBlood(5)) = 115
        assert_eq!(ar.blood, 115.0);
    }

    #[test]
    fn non_dual_total_is_max_line() {
        let mut w = weapon("Test Cannon", WeaponType::Conv);
        w.phys = 100;

        let mut g = gem();
        g.dmg_bolt = 2.0;

        let ar = compute_ar(&w, [Some(&g), None, None], &ZERO_STATS);

        assert_eq!(ar.converted_element, ConvertedElement::Bolt);
        // bolt = floor(elemBase(100) * 2.0) = 200, which dominates the max.
        assert_eq!(ar.bolt, 200.0);
        assert_eq!(ar.total, 200.0);
    }
}
