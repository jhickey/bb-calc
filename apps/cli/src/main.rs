use bb_calc::{
    build_inventory_from_save, compute_ar, optimizer, DamageTarget, Inventory, OptimizeResult, Stats,
    Weapon,
};
use clap::{Parser, Subcommand, ValueEnum};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::SystemTime;
use std::{env, fs};
use uuid::Uuid;

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    /// Optional name to operate on
    name: Option<String>,

    /// Sets a custom config file
    #[arg(short, long, value_name = "FILE")]
    config: Option<PathBuf>,

    /// Turn debugging information on
    #[arg(short, long, action = clap::ArgAction::Count)]
    debug: u8,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    Calc {
        #[arg(short, long)]
        weapon: String,
        #[arg(long)]
        skl: Option<u16>,
        #[arg(long)]
        str: Option<u16>,
        #[arg(long)]
        blt: Option<u16>,
        #[arg(long)]
        arc: Option<u16>,
    },
    Init {},
    Import {
        file: PathBuf,
    },
    /// Find the best socketing of the active inventory's gems for a weapon,
    /// using that weapon variant's own imprint slots.
    Optimize {
        /// Weapon variant id (e.g. "saw_cleaver", "saw_cleaver_uncanny").
        #[arg(short, long)]
        weapons: Vec<String>,
        /// Damage line to maximize: total (default), phys, blunt, thrust, arcane,
        /// fire, bolt, or blood.
        #[arg(short, long, default_value = "total")]
        target: String,
        #[arg(value_enum, short, long, default_value = "compare")]
        mode: Mode,
        /// Stat overrides; default to the imported character's stats, else 50.
        #[arg(long)]
        str: Option<u16>,
        #[arg(long)]
        skl: Option<u16>,
        #[arg(long)]
        blt: Option<u16>,
        #[arg(long)]
        arc: Option<u16>,
        #[arg(short, long)]
        exclude: Option<Vec<String>>,
    },
}

#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, ValueEnum)]
enum Mode {
    Compare,
    Plan,
}

impl From<&Mode> for optimizer::Mode {
    fn from(value: &Mode) -> Self {
        match value {
            Mode::Compare => optimizer::Mode::Compare,
            Mode::Plan => optimizer::Mode::Plan,
        }
    }
}

/// Map a `--target` string to a [`DamageTarget`].
fn parse_target(s: &str) -> Result<DamageTarget, String> {
    match s.to_ascii_lowercase().as_str() {
        "total" => Ok(DamageTarget::Total),
        "phys" | "physical" => Ok(DamageTarget::Phys),
        "blunt" => Ok(DamageTarget::Blunt),
        "thrust" => Ok(DamageTarget::Thrust),
        "arcane" | "arc" => Ok(DamageTarget::Arcane),
        "fire" => Ok(DamageTarget::Fire),
        "bolt" => Ok(DamageTarget::Bolt),
        "blood" => Ok(DamageTarget::Blood),
        other => Err(format!(
            "unknown target {other:?} (valid: total, phys, blunt, thrust, arcane, fire, bolt, blood)"
        )),
    }
}

#[derive(Serialize, Deserialize)]
struct Config {
    active_inventory: Option<String>,
}

impl Config {
    fn get_config_dir() -> PathBuf {
        let mut path = env::home_dir().unwrap();
        path.push(".config");
        path.push("bb-calc");
        path
    }
    fn load() -> Config {
        let config_path = Self::get_config_dir().join("config.json");
        if !config_path.exists() {
            let config = Config {
                active_inventory: None,
            };
            fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap())
                .expect("Could not write config");
        }
        let config = fs::read_to_string(&config_path).expect("Could not read config");
        serde_json::from_str(&config).unwrap()
    }
    fn save(&self) {
        let config_path = Self::get_config_dir().join("config.json");
        fs::write(&config_path, serde_json::to_string_pretty(&self).unwrap())
            .expect("Could not write config");
    }
    fn set_active_inventory(inventory: &str) {
        let mut config = Self::load();
        config.active_inventory = Some(inventory.to_string());
        config.save();
    }
    fn get_active_inventory() -> Option<Inventory> {
        let active_inventory = Self::load().active_inventory;
        if active_inventory.is_none() {
            return None;
        }
        let inventory_path = Self::get_config_dir()
            .join("inventories")
            .join(active_inventory.unwrap() + ".json");
        let inventory = fs::read_to_string(&inventory_path).expect("Could not read inventory");
        serde_json::from_str(&inventory).unwrap()
    }
}

fn print_optimize_result(target: DamageTarget, stats: Stats, result: &OptimizeResult) {
    let weapon = Weapon::by_id(&result.weapon_id).unwrap();
    println!(
        "{} (STR {} / SKL {} / BLT {} / ARC {})",
        weapon.name, stats.str, stats.skl, stats.blt, stats.arc
    );
    println!(
        "Best {:?}: {}  (total AR {})",
        target, result.score, result.total
    );
    for slot in &result.slots {
        match &slot.gem {
            Some(g) => println!(
                "  slot {} [{:?}]: ({}) {} — {}",
                slot.slot + 1,
                slot.slot_shape,
                g.id,
                g.name,
                g.effects.join("; ")
            ),
            None => {
                println!("  slot {} [{:?}]: (empty)", slot.slot + 1, slot.slot_shape)
            }
        }
    }
    println!();
}

fn main() {
    let cli = Cli::parse();

    match &cli.command {
        Some(Commands::Calc {
            weapon,
            skl,
            str,
            blt,
            arc,
        }) => {
            let weapon = Weapon::by_id(&weapon)
                .ok_or_else(|| {
                    eprintln!("error: weapon \"{weapon}\" not found");
                    std::process::exit(1);
                })
                .unwrap();

            let stats = Stats {
                str: str.unwrap_or(50),
                skl: skl.unwrap_or(50),
                blt: blt.unwrap_or(50),
                arc: arc.unwrap_or(50),
            };

            let result = compute_ar(weapon, [None, None, None], &stats);
            println!("{:?}", result);
        }
        Some(Commands::Init {}) => match env::home_dir() {
            Some(path) => {
                let config_path = path.join(".config").join("bb-calc").join("config.json");
                let _ = fs::create_dir_all(config_path.parent().unwrap());
                println!("config path: {:?}", config_path);
            }
            None => println!("Cannot determine home directory!"),
        },
        Some(Commands::Import { file }) => {
            let file = file.canonicalize().unwrap();
            let inventory_dir = Config::get_config_dir().join("inventories");
            fs::create_dir_all(&inventory_dir).expect("Could not create inventories directory");
            let inventory = build_inventory_from_save(
                &fs::read(&file).expect("Could not read save file"),
                Some(file.to_str().unwrap()),
            );
            if !inventory.warnings.is_empty() {
                println!("Warnings: {:?}", inventory.warnings);
            }
            let filename = Uuid::new_v4().to_string() + ".json";
            fs::write(
                &inventory_dir.join(&filename),
                serde_json::to_string_pretty(&inventory.value).unwrap(),
            )
            .expect("Could not write inventory");
            Config::set_active_inventory(filename.split(".").next().unwrap());
            println!("Inventory saved to {:?}", inventory_dir.join(&filename));
        }
        Some(Commands::Optimize {
            weapons,
            target,
            mode,
            str,
            skl,
            blt,
            arc,
            exclude,
        }) => {
            let start = SystemTime::now();

            let target = parse_target(target).unwrap_or_else(|e| {
                eprintln!("error: {e}");
                std::process::exit(1);
            });

            let Some(inventory) = Config::get_active_inventory() else {
                eprintln!("error: no active inventory; run `import` first");
                std::process::exit(1);
            };

            // Stats: imported character's stats, with per-flag overrides; 50 each
            // when neither is available.
            let base = inventory.stats.unwrap_or(Stats {
                str: 50,
                skl: 50,
                blt: 50,
                arc: 50,
            });

            let stats = Stats {
                str: str.unwrap_or(base.str),
                skl: skl.unwrap_or(base.skl),
                blt: blt.unwrap_or(base.blt),
                arc: arc.unwrap_or(base.arc),
            };

            let weapons = if weapons.is_empty() {
                Weapon::all().iter().map(|w| w).collect()
            } else {
                weapons.iter().map(|w| Weapon::by_id(w).unwrap()).collect()
            };

            let results = optimizer::optimize(
                weapons,
                inventory.gems,
                &stats,
                target,
                optimizer::Mode::from(mode),
                exclude.clone(),
            );
            for result in results {
                print_optimize_result(target, stats, &result);
            }
            let duration = SystemTime::now().duration_since(start).unwrap();
            println!(
                "Optimization took {}.{:03} seconds",
                duration.as_secs(),
                duration.subsec_millis()
            );
        }
        None => {}
    }
}
