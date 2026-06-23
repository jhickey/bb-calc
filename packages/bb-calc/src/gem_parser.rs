//! Parse a friendly effect-token spec into a [`Gem`]. Pure, no I/O — mirrors the
//! calc engine so it can be unit-tested in isolation.
//!
//! A spec is a `;`-separated list of clauses; each clause is one of three forms
//! (keywords are case-insensitive; `.` and `,` both work as decimal separators,
//! matching how gems are written in-game; numbers may be signed so curses are
//! expressible):
//!
//!  - Multiplier  `<type> <n>%`        → field *= 1 + n/100
//!      phys, blunt, thrust, arc|arcane, fire, bolt, blood|tinge,
//!      atk|nourishing, open|openfoes, striking, kin|kinhunter, beast|beasthunter
//!  - Flat damage `<+/-n> <type>`      → field += n   (leading sign required)
//!      phys, arc|arcane, fire, bolt, blood
//!  - Scaling     `<stat>-scale <n>`   → field += n
//!      str-scale, skl-scale, blt-scale, arc-scale
//!
//! The clause *form* disambiguates the overloaded keywords, e.g. `arc 30%`
//! (dmg_arcane) vs `+18 arc` (flat_arcane) vs `arc-scale 0.42` (arc_scale).
//!
//! Example: `parse_gem_effects("phys 27.2%; +15 phys", None)`

use crate::types::Gem;

/// A gem with no effects: identity multipliers, zero flats/scaling.
pub fn base_gem(name: &str) -> Gem {
    Gem {
        name: name.to_string(),
        source: "custom".to_string(),
        tier: 0,
        shape: None,
        arc_scale: 0.0,
        str_scale: 0.0,
        skl_scale: 0.0,
        blt_scale: 0.0,
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

/// The valid multiplier keywords (for error messages), in the same order as the
/// TypeScript `MULT_FIELDS` map.
const MULT_KEYWORDS: &str = "phys, blunt, thrust, arc, arcane, fire, bolt, blood, tinge, atk, nourishing, \
     open, openfoes, striking, kin, kinhunter, beast, beasthunter";
const FLAT_KEYWORDS: &str = "phys, arc, arcane, fire, bolt, blood";

/// Parse a number accepting either `.` or `,` as the decimal separator.
fn parse_num(raw: &str) -> Result<f32, String> {
    let v: f32 = raw
        .replace(',', ".")
        .parse()
        .map_err(|_| format!("\"{raw}\" is not a number"))?;
    if !v.is_finite() {
        return Err(format!("\"{raw}\" is not a number"));
    }
    Ok(v)
}

/// Does `s` look like `[+-]?[0-9.,]+`? With `require_sign`, the leading sign is
/// mandatory (the flat-damage form).
fn is_numeric_token(s: &str, require_sign: bool) -> bool {
    let signed = s.starts_with('+') || s.starts_with('-');
    if require_sign && !signed {
        return false;
    }
    let body = if signed { &s[1..] } else { s };
    !body.is_empty()
        && body
            .chars()
            .all(|c| c.is_ascii_digit() || c == '.' || c == ',')
}

fn is_word(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_alphabetic())
}

/// `<stat>-scale <n>` (whitespace around the dash is allowed). Returns `(stat, n)`.
fn scale_form(clause: &str) -> Option<(String, String)> {
    let lower = clause.to_ascii_lowercase();
    let tokens: Vec<&str> = lower.split_whitespace().collect();
    if tokens.len() < 2 {
        return None;
    }
    let num = tokens[tokens.len() - 1];
    if !is_numeric_token(num, false) {
        return None;
    }
    // Joining the leading tokens collapses optional spaces, so "str - scale" and
    // "str-scale" both become "str-scale".
    let left = tokens[..tokens.len() - 1].concat();
    let stat = left.strip_suffix("-scale")?;
    if is_word(stat) {
        Some((stat.to_string(), num.to_string()))
    } else {
        None
    }
}

/// `<+/-n> <type>` (leading sign required). Returns `(n, type)`.
fn flat_form(clause: &str) -> Option<(String, String)> {
    let tokens: Vec<&str> = clause.split_whitespace().collect();
    if tokens.len() != 2 || !is_numeric_token(tokens[0], true) {
        return None;
    }
    let ty = tokens[1].to_ascii_lowercase();
    if is_word(&ty) {
        Some((tokens[0].to_string(), ty))
    } else {
        None
    }
}

/// `<type> <n>%` (whitespace before `%` allowed). Returns `(type, n)`.
fn mult_form(clause: &str) -> Option<(String, String)> {
    let body = clause.trim().strip_suffix('%')?;
    let tokens: Vec<&str> = body.split_whitespace().collect();
    if tokens.len() != 2 || !is_numeric_token(tokens[1], false) {
        return None;
    }
    let ty = tokens[0].to_ascii_lowercase();
    if is_word(&ty) {
        Some((ty, tokens[1].to_string()))
    } else {
        None
    }
}

fn apply_clause(gem: &mut Gem, clause: &str) -> Result<(), String> {
    // Try the three forms in the same precedence as the TypeScript regexes. The
    // forms are mutually exclusive by shape, so the first that matches wins.
    if let Some((stat, num)) = scale_form(clause) {
        let field: &mut f32 = match stat.as_str() {
            "str" => &mut gem.str_scale,
            "skl" => &mut gem.skl_scale,
            "blt" | "bloodtinge" => &mut gem.blt_scale,
            "arc" | "arcane" => &mut gem.arc_scale,
            _ => {
                return Err(format!(
                    "\"{clause}\": no scaling effect \"{stat}\" (valid: str-scale, skl-scale, blt-scale, arc-scale)"
                ));
            }
        };
        *field += parse_num(&num)?;
        return Ok(());
    }

    if let Some((num, ty)) = flat_form(clause) {
        let field: &mut f32 = match ty.as_str() {
            "phys" => &mut gem.flat_phys,
            "arc" | "arcane" => &mut gem.flat_arcane,
            "fire" => &mut gem.flat_fire,
            "bolt" => &mut gem.flat_bolt,
            "blood" => &mut gem.flat_blood,
            _ => {
                return Err(format!(
                    "\"{clause}\": no flat-damage type \"{ty}\" (valid: {FLAT_KEYWORDS})"
                ));
            }
        };
        *field += parse_num(&num)?;
        return Ok(());
    }

    if let Some((ty, num)) = mult_form(clause) {
        let field: &mut f32 = match ty.as_str() {
            "phys" => &mut gem.dmg_phys,
            "blunt" => &mut gem.dmg_blunt,
            "thrust" => &mut gem.dmg_thrust,
            "arc" | "arcane" => &mut gem.dmg_arcane,
            "fire" => &mut gem.dmg_fire,
            "bolt" => &mut gem.dmg_bolt,
            "blood" | "tinge" => &mut gem.dmg_blood,
            "atk" | "nourishing" => &mut gem.dmg_general,
            "open" | "openfoes" => &mut gem.open_foes,
            "striking" => &mut gem.striking,
            "kin" | "kinhunter" => &mut gem.kinhunter,
            "beast" | "beasthunter" => &mut gem.beasthunter,
            _ => {
                return Err(format!(
                    "\"{clause}\": no percentage effect \"{ty}\" (valid: {MULT_KEYWORDS})"
                ));
            }
        };
        *field *= 1.0 + parse_num(&num)? / 100.0;
        return Ok(());
    }

    Err(format!(
        "Could not parse \"{clause}\". Expected \"<type> <n>%\", \"<+/-n> <type>\", or \"<stat>-scale <n>\"."
    ))
}

/// Parse an effect spec into a [`Gem`], naming it `name` (defaulting to "Custom").
pub fn parse_gem_effects(spec: &str, name: Option<&str>) -> Result<Gem, String> {
    let mut gem = base_gem(name.unwrap_or("Custom"));
    let clauses: Vec<&str> = spec
        .split(';')
        .map(str::trim)
        .filter(|c| !c.is_empty())
        .collect();
    if clauses.is_empty() {
        return Err("Empty gem spec. Example: \"phys 27.2%; +15 phys\"".to_string());
    }
    for clause in clauses {
        apply_clause(&mut gem, clause)?;
    }
    Ok(gem)
}

/// Apply one *in-game* effect string (as stored on an imported gem, e.g.
/// "Physical ATK UP +27.2%", "Add fire ATK +50", "STR scaling +9.9") onto `gem`.
///
/// Returns `false` when the effect has no representation in the AR [`Gem`] model
/// — conditionals ("ATK UP near death"), charge/rally/durability/stamina/poison/HP
/// effects, flat all-type ATK (no per-type field), and "No Effect" — so the caller
/// can surface it as skipped. Scaling values are percentage points (`÷100`), so
/// "STR scaling +9.9" contributes `0.099` to the coefficient (matching the calc's
/// additive `weapon.str_scale + gem.str_scale`).
fn apply_ingame_effect(gem: &mut Gem, effect: &str) -> bool {
    let tokens: Vec<&str> = effect.split_whitespace().collect();
    if tokens.len() < 2 {
        return false; // e.g. "No Effect"
    }
    let last = tokens[tokens.len() - 1];
    let (num_str, is_pct) = match last.strip_suffix('%') {
        Some(n) => (n, true),
        None => (last, false),
    };
    let Ok(value) = num_str.parse::<f32>() else {
        return false;
    };
    if !value.is_finite() {
        return false;
    }
    let prefix = tokens[..tokens.len() - 1].join(" ");

    // Percentage multipliers: field *= 1 + value/100. "DOWN" effects carry a
    // negative value, so the same arithmetic expresses the curse.
    if is_pct {
        let field: Option<&mut f32> = match prefix.as_str() {
            "Physical ATK UP" => Some(&mut gem.dmg_phys),
            "Blunt ATK UP" => Some(&mut gem.dmg_blunt),
            "Thrust ATK UP" => Some(&mut gem.dmg_thrust),
            "Arcane ATK UP" => Some(&mut gem.dmg_arcane),
            "Fire ATK UP" => Some(&mut gem.dmg_fire),
            "Bolt ATK UP" => Some(&mut gem.dmg_bolt),
            "Blood ATK UP" => Some(&mut gem.dmg_blood),
            "ATK UP" | "ATK DOWN" => Some(&mut gem.dmg_general),
            "ATK vs beasts UP" | "ATK vs beasts DOWN" => Some(&mut gem.beasthunter),
            "ATK vs kin UP" | "ATK vs the kin UP" | "ATK vs the kin DOWN" => {
                Some(&mut gem.kinhunter)
            }
            "ATK vs open foes UP" => Some(&mut gem.open_foes),
            _ => None,
        };
        if let Some(f) = field {
            *f *= 1.0 + value / 100.0;
            return true;
        }
    }

    // Flat per-type ATK adds: field += value.
    {
        let field: Option<&mut f32> = match prefix.as_str() {
            "Add physical ATK" => Some(&mut gem.flat_phys),
            "Add arcane ATK" => Some(&mut gem.flat_arcane),
            "Add fire ATK" => Some(&mut gem.flat_fire),
            "Add bolt ATK" => Some(&mut gem.flat_bolt),
            "Add blood ATK" => Some(&mut gem.flat_blood),
            _ => None,
        };
        if let Some(f) = field {
            *f += value;
            return true;
        }
    }

    // Scaling: percentage points added to the scaling coefficient (value/100).
    {
        let field: Option<&mut f32> = match prefix.as_str() {
            "STR scaling" => Some(&mut gem.str_scale),
            "SKL scaling" => Some(&mut gem.skl_scale),
            "Bloodtinge scaling" => Some(&mut gem.blt_scale),
            "Arcane scaling" => Some(&mut gem.arc_scale),
            _ => None,
        };
        if let Some(f) = field {
            *f += value / 100.0;
            return true;
        }
    }

    false
}

/// Build a [`Gem`] from a physical gem's *in-game* effect strings (as captured on
/// an imported `InventoryGem`). The returned `Vec` lists effects that could not be
/// modeled by the AR calc, in input order, so callers can warn about them.
pub fn gem_from_ingame_effects(name: &str, effects: &[String]) -> (Gem, Vec<String>) {
    let mut gem = base_gem(name);
    gem.source = "inventory".to_string();
    let mut skipped = Vec::new();
    for effect in effects {
        if !apply_ingame_effect(&mut gem, effect) {
            skipped.push(effect.clone());
        }
    }
    (gem, skipped)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(spec: &str) -> Gem {
        parse_gem_effects(spec, None).expect("spec parses")
    }

    #[test]
    fn parses_a_percentage_multiplier() {
        assert!((parse("phys 27.2%").dmg_phys - 1.272).abs() < 1e-6);
    }

    #[test]
    fn parses_a_flat_damage_add_leading_sign_required() {
        assert_eq!(parse("+15 phys").flat_phys, 15.0);
    }

    #[test]
    fn parses_a_scaling_add() {
        assert_eq!(parse("str-scale 0.65").str_scale, 0.65);
    }

    #[test]
    fn disambiguates_arc_across_the_three_forms() {
        assert!((parse("arc 30%").dmg_arcane - 1.3).abs() < 1e-6);
        assert_eq!(parse("+18 arc").flat_arcane, 18.0);
        assert_eq!(parse("arc-scale 0.42").arc_scale, 0.42);
    }

    #[test]
    fn maps_every_multiplier_keyword_to_the_right_field() {
        assert!((parse("blunt 10%").dmg_blunt - 1.1).abs() < 1e-6);
        assert!((parse("thrust 10%").dmg_thrust - 1.1).abs() < 1e-6);
        assert!((parse("fire 10%").dmg_fire - 1.1).abs() < 1e-6);
        assert!((parse("bolt 10%").dmg_bolt - 1.1).abs() < 1e-6);
        assert!((parse("tinge 10%").dmg_blood - 1.1).abs() < 1e-6);
        assert!((parse("nourishing 10%").dmg_general - 1.1).abs() < 1e-6);
        assert!((parse("atk 10%").dmg_general - 1.1).abs() < 1e-6);
        assert!((parse("openfoes 10%").open_foes - 1.1).abs() < 1e-6);
        assert!((parse("striking 10%").striking - 1.1).abs() < 1e-6);
        assert!((parse("kin 10%").kinhunter - 1.1).abs() < 1e-6);
        assert!((parse("beast 10%").beasthunter - 1.1).abs() < 1e-6);
    }

    #[test]
    fn combines_multiple_clauses() {
        let g = parse("fire 24.75%; +15 fire");
        assert!((g.dmg_fire - 1.2475).abs() < 1e-6);
        assert_eq!(g.flat_fire, 15.0);
    }

    #[test]
    fn accepts_comma_as_a_decimal_separator() {
        assert!((parse("phys 27,2%").dmg_phys - 1.272).abs() < 1e-6);
        assert_eq!(parse("+67,5 fire").flat_fire, 67.5);
    }

    #[test]
    fn supports_negative_curse_values() {
        assert!((parse("atk -10%").dmg_general - 0.9).abs() < 1e-6);
        assert_eq!(parse("-30 phys").flat_phys, -30.0);
    }

    #[test]
    fn is_case_and_whitespace_insensitive() {
        let g = parse("  PHYS 10% ;   +5 FIRE  ");
        assert!((g.dmg_phys - 1.1).abs() < 1e-6);
        assert_eq!(g.flat_fire, 5.0);
    }

    #[test]
    fn uses_the_provided_name_defaulting_to_custom() {
        assert_eq!(parse("phys 10%").name, "Custom");
        assert_eq!(
            parse_gem_effects("phys 10%", Some("My Gem")).unwrap().name,
            "My Gem"
        );
        assert_eq!(parse("phys 10%").source, "custom");
    }

    #[test]
    fn throws_on_an_unknown_keyword() {
        assert!(
            parse_gem_effects("xyz 10%", None)
                .unwrap_err()
                .contains("no percentage effect")
        );
        assert!(
            parse_gem_effects("+5 striking", None)
                .unwrap_err()
                .contains("no flat-damage type")
        );
    }

    #[test]
    fn throws_on_an_unparseable_clause() {
        assert!(
            parse_gem_effects("phys", None)
                .unwrap_err()
                .contains("Could not parse")
        );
        assert!(
            parse_gem_effects("", None)
                .unwrap_err()
                .contains("Empty gem spec")
        );
    }

    #[test]
    fn parses_skl_and_blt_scaling_in_the_friendly_form() {
        assert_eq!(parse("skl-scale 0.5").skl_scale, 0.5);
        assert_eq!(parse("blt-scale 0.4").blt_scale, 0.4);
        assert_eq!(parse("bloodtinge-scale 0.4").blt_scale, 0.4);
    }

    #[test]
    fn ingame_maps_multipliers_flats_and_scaling() {
        let (g, skipped) = gem_from_ingame_effects(
            "Test",
            &[
                "Physical ATK UP +27.2%".to_string(),
                "Add fire ATK +50".to_string(),
                "STR scaling +9.9".to_string(),
            ],
        );
        assert!((g.dmg_phys - 1.272).abs() < 1e-6);
        assert_eq!(g.flat_fire, 50.0);
        // Scaling is percentage points: +9.9 -> 0.099.
        assert!((g.str_scale - 0.099).abs() < 1e-6);
        assert!(skipped.is_empty());
        assert_eq!(g.source, "inventory");
    }

    #[test]
    fn ingame_maps_every_scaling_stat_to_its_coefficient() {
        let scale = |e: &str| {
            let (g, s) = gem_from_ingame_effects("g", &[e.to_string()]);
            assert!(s.is_empty(), "{e} should map");
            g
        };
        assert!((scale("SKL scaling +5").skl_scale - 0.05).abs() < 1e-6);
        assert!((scale("Bloodtinge scaling +5").blt_scale - 0.05).abs() < 1e-6);
        assert!((scale("Arcane scaling +5").arc_scale - 0.05).abs() < 1e-6);
    }

    #[test]
    fn ingame_treats_down_effects_as_negative_multipliers() {
        let (g, skipped) = gem_from_ingame_effects("Cursed", &["ATK DOWN -10.5%".to_string()]);
        assert!((g.dmg_general - 0.895).abs() < 1e-6);
        assert!(skipped.is_empty());
    }

    #[test]
    fn ingame_skips_effects_with_no_ar_representation() {
        let (g, skipped) = gem_from_ingame_effects(
            "Mixed",
            &[
                "Physical ATK UP +20%".to_string(),
                "ATK UP near death +10%".to_string(), // conditional -> skipped
                "WPN durability DOWN -100".to_string(), // irrelevant -> skipped
                "No Effect".to_string(),
                "ATK DOWN -10".to_string(), // flat all-type, no field -> skipped
            ],
        );
        assert!((g.dmg_phys - 1.2).abs() < 1e-6);
        assert_eq!(
            skipped,
            vec![
                "ATK UP near death +10%".to_string(),
                "WPN durability DOWN -100".to_string(),
                "No Effect".to_string(),
                "ATK DOWN -10".to_string(),
            ]
        );
    }
}
