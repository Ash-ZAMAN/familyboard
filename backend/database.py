import sqlite3
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "familyboard.db"


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def get_iso_week(dt: datetime) -> str:
    year, week, _ = dt.isocalendar()
    return f"{year}-W{week:02d}"


def get_iso_month(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # Settings table (single row id=1)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            theme TEXT NOT NULL DEFAULT 'dark',
            wallpaper_url TEXT NOT NULL DEFAULT '',
            card_opacity REAL NOT NULL DEFAULT 0.88,
            parent_pin TEXT NOT NULL DEFAULT '1234',
            city TEXT NOT NULL DEFAULT 'Paris',
            country TEXT NOT NULL DEFAULT 'France',
            latitude REAL NOT NULL DEFAULT 48.8566,
            longitude REAL NOT NULL DEFAULT 2.3522,
            prayer_method INTEGER NOT NULL DEFAULT 12,
            ical_url TEXT NOT NULL DEFAULT ''
        )
    """)

    # Family members (4 main slots for 2x2 grid, or more)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'Enfant',
            color TEXT NOT NULL DEFAULT '#3B82F6',
            avatar TEXT NOT NULL DEFAULT '',
            points INTEGER NOT NULL DEFAULT 0,
            goal_points INTEGER NOT NULL DEFAULT 50,
            display_order INTEGER NOT NULL DEFAULT 0
        )
    """)

    # Daily recurring routines / chores
    cur.execute("""
        CREATE TABLE IF NOT EXISTS daily_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            member_id INTEGER,
            days_of_week TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
            points_reward INTEGER NOT NULL DEFAULT 5,
            icon TEXT NOT NULL DEFAULT 'check-circle',
            display_order INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
        )
    """)

    # Daily task completion per date (YYYY-MM-DD)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS task_completions (
            task_id INTEGER NOT NULL,
            completion_date TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'validated',
            PRIMARY KEY (task_id, completion_date),
            FOREIGN KEY (task_id) REFERENCES daily_tasks(id) ON DELETE CASCADE
        )
    """)
    try:
        cur.execute("ALTER TABLE task_completions ADD COLUMN status TEXT NOT NULL DEFAULT 'validated'")
    except sqlite3.OperationalError:
        pass

    # Weekly calendar events
    cur.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            member_id INTEGER,
            category_color TEXT NOT NULL DEFAULT '#10B981',
            event_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            location TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT 'local',
            external_uid TEXT,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
        )
    """)

    # Weekly & Monthly Goals (with automatic roll-over support)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
            period_key TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            member_id INTEGER,
            points_reward INTEGER NOT NULL DEFAULT 10,
            rolled_over_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
        )
    """)

    # Family Recipes
    cur.execute("""
        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'Plat principal',
            prep_time INTEGER NOT NULL DEFAULT 15,
            cook_time INTEGER NOT NULL DEFAULT 20,
            servings INTEGER NOT NULL DEFAULT 4,
            image_url TEXT NOT NULL DEFAULT '',
            ingredients_json TEXT NOT NULL DEFAULT '[]',
            steps_json TEXT NOT NULL DEFAULT '[]',
            tags_json TEXT NOT NULL DEFAULT '[]'
        )
    """)

    # Offline cache for Weather and Prayer Times
    cur.execute("""
        CREATE TABLE IF NOT EXISTS api_cache (
            cache_key TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    conn.commit()
    seed_if_empty(conn)
    apply_goal_rollover(conn)
    conn.close()


def apply_goal_rollover(conn: sqlite3.Connection):
    """
    Automatic roll-over ("Report automatique"):
    Any uncompleted goal from a past week or past month is automatically rolled over
    to the current week/month and incremented in rolled_over_count.
    """
    now = datetime.now()
    current_week = get_iso_week(now)
    current_month = get_iso_month(now)
    cur = conn.cursor()

    cur.execute(
        """
        UPDATE goals
        SET period_key = ?, rolled_over_count = rolled_over_count + 1
        WHERE period_type = 'weekly' AND completed = 0 AND period_key < ?
        """,
        (current_week, current_week),
    )
    cur.execute(
        """
        UPDATE goals
        SET period_key = ?, rolled_over_count = rolled_over_count + 1
        WHERE period_type = 'monthly' AND completed = 0 AND period_key < ?
        """,
        (current_month, current_month),
    )
    conn.commit()


def make_avatar_svg_data_uri(initials: str, bg_hex: str, accent_hex: str, emoji: str) -> str:
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="{bg_hex}"/>
          <stop offset="100%" stop-color="{accent_hex}"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="60" fill="url(#g)"/>
      <text x="60" y="74" font-size="48" text-anchor="middle" dominant-baseline="middle">{emoji}</text>
    </svg>"""
    import urllib.parse
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)


def make_recipe_svg_data_uri(title: str, grad1: str, grad2: str, emoji: str) -> str:
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
      <defs>
        <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="{grad1}"/>
          <stop offset="100%" stop-color="{grad2}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#rg)"/>
      <circle cx="680" cy="100" r="180" fill="rgba(255,255,255,0.08)"/>
      <circle cx="120" cy="420" r="220" fill="rgba(0,0,0,0.12)"/>
      <text x="400" y="235" font-size="135" text-anchor="middle" dominant-baseline="middle">{emoji}</text>
      <text x="400" y="395" font-family="system-ui, sans-serif" font-weight="700" font-size="36" fill="rgba(255,255,255,0.92)" text-anchor="middle">{title}</text>
    </svg>"""
    import urllib.parse
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)


def seed_if_empty(conn: sqlite3.Connection):
    cur = conn.cursor()

    # Ensure settings row exists
    cur.execute("SELECT COUNT(*) as cnt FROM settings")
    if cur.fetchone()["cnt"] == 0:
        cur.execute("""
            INSERT INTO settings (
                id, theme, wallpaper_url, card_opacity, parent_pin,
                city, country, latitude, longitude, prayer_method, ical_url
            ) VALUES (
                1, 'dark', '', 0.88, '1234',
                'Paris', 'France', 48.8566, 2.3522, 12, ''
            )
        """)

    # Seed Members if empty
    cur.execute("SELECT COUNT(*) as cnt FROM members")
    if cur.fetchone()["cnt"] == 0:
        members_seed = [
            (
                "Papa",
                "Parent",
                "#F59E0B",
                make_avatar_svg_data_uri("PA", "#D97706", "#F59E0B", "🧔🏻"),
                42,
                50,
                1,
            ),
            (
                "Maman",
                "Parent",
                "#EC4899",
                make_avatar_svg_data_uri("MA", "#DB2777", "#F472B6", "👩🏻"),
                46,
                50,
                2,
            ),
            (
                "Léo",
                "Enfant",
                "#3B82F6",
                make_avatar_svg_data_uri("LE", "#2563EB", "#60A5FA", "👦🏻"),
                32,
                50,
                3,
            ),
            (
                "Emma",
                "Enfant",
                "#8B5CF6",
                make_avatar_svg_data_uri("EM", "#7C3AED", "#A78BFA", "👧🏻"),
                38,
                50,
                4,
            ),
        ]
        cur.executemany(
            """
            INSERT INTO members (name, role, color, avatar, points, goal_points, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            members_seed,
        )

    # Fetch member IDs for linking
    cur.execute("SELECT id, name, color FROM members")
    member_map = {row["name"]: dict(row) for row in cur.fetchall()}
    leo_id = member_map.get("Léo", {}).get("id")
    emma_id = member_map.get("Emma", {}).get("id")
    papa_id = member_map.get("Papa", {}).get("id")
    maman_id = member_map.get("Maman", {}).get("id")

    # Seed Daily Tasks ("La liste du jour")
    cur.execute("SELECT COUNT(*) as cnt FROM daily_tasks")
    if cur.fetchone()["cnt"] == 0:
        all_days = json.dumps([0, 1, 2, 3, 4, 5, 6])
        school_days = json.dumps([0, 1, 2, 3, 4])
        tasks_seed = [
            ("Faire son lit", leo_id, all_days, 5, "bed", 1),
            ("Lire 15 min", emma_id, all_days, 5, "book-open", 2),
            ("Sortir le chien", papa_id, all_days, 5, "dog", 3),
            ("Mettre la table", leo_id, all_days, 5, "utensils", 4),
            ("Préparer le cartable", emma_id, school_days, 5, "backpack", 5),
            ("Ranger les jouets du salon", None, all_days, 5, "sparkles", 6),
        ]
        cur.executemany(
            """
            INSERT INTO daily_tasks (title, member_id, days_of_week, points_reward, icon, display_order)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            tasks_seed,
        )

        # Pre-complete 1 validated task and 1 pending task for today so the board looks alive out-of-the-box
        today_str = datetime.now().strftime("%Y-%m-%d")
        cur.execute("SELECT id FROM daily_tasks ORDER BY display_order ASC LIMIT 2")
        seed_rows = cur.fetchall()
        for idx, r in enumerate(seed_rows):
            st = "validated" if idx == 0 else "pending"
            cur.execute(
                "INSERT OR IGNORE INTO task_completions (task_id, completion_date, completed_at, status) VALUES (?, ?, ?, ?)",
                (r["id"], today_str, datetime.now().isoformat(), st),
            )

    # Seed Weekly Events ("L'agenda de la semaine")
    cur.execute("SELECT COUNT(*) as cnt FROM events")
    if cur.fetchone()["cnt"] == 0:
        now = datetime.now()
        # Monday of the current week
        monday = now - timedelta(days=now.weekday())
        d_mon = monday.strftime("%Y-%m-%d")
        d_tue = (monday + timedelta(days=1)).strftime("%Y-%m-%d")
        d_wed = (monday + timedelta(days=2)).strftime("%Y-%m-%d")
        d_thu = (monday + timedelta(days=3)).strftime("%Y-%m-%d")
        d_fri = (monday + timedelta(days=4)).strftime("%Y-%m-%d")
        d_sat = (monday + timedelta(days=5)).strftime("%Y-%m-%d")
        d_sun = (monday + timedelta(days=6)).strftime("%Y-%m-%d")

        events_seed = [
            (
                "Foot - Léo",
                leo_id,
                "#3B82F6",
                d_tue,
                "17:30",
                "19:00",
                "Stade Municipal",
                "Entraînement U11 - Penser aux protège-tibias et à la gourde",
                "local",
            ),
            (
                "Dentiste - Emma",
                emma_id,
                "#8B5CF6",
                d_wed,
                "14:30",
                "15:15",
                "Cabinet Dr. Martin",
                "Contrôle annuel et détartrage",
                "local",
            ),
            (
                "Cours de Piano - Emma",
                emma_id,
                "#8B5CF6",
                d_thu,
                "17:00",
                "18:00",
                "Conservatoire",
                "Apporter le cahier de solfège",
                "local",
            ),
            (
                "Courses Bio & Marché",
                papa_id,
                "#F59E0B",
                d_fri,
                "18:00",
                "19:15",
                "Marché couvert",
                "Fruits, légumes de saison et pain au levain",
                "local",
            ),
            (
                "Match de Foot - Léo",
                leo_id,
                "#3B82F6",
                d_sat,
                "10:00",
                "12:00",
                "Complexe Sportif Jean Moulin",
                "Match à domicile - Maillot bleu requis",
                "local",
            ),
            (
                "Dîner de famille",
                None,
                "#10B981",
                d_sat,
                "19:30",
                "22:30",
                "À la maison",
                "Grand couscous royal et soirée jeux de société en famille",
                "local",
            ),
            (
                "Sortie Parc & Vélo",
                maman_id,
                "#EC4899",
                d_sun,
                "15:00",
                "17:30",
                "Parc Floral",
                "Balade à vélo tous ensemble et goûter en plein air",
                "local",
            ),
        ]
        cur.executemany(
            """
            INSERT INTO events (title, member_id, category_color, event_date, start_time, end_time, location, description, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            events_seed,
        )

    # Seed Weekly & Monthly Goals ("Objectifs")
    cur.execute("SELECT COUNT(*) as cnt FROM goals")
    if cur.fetchone()["cnt"] == 0:
        now = datetime.now()
        w_key = get_iso_week(now)
        m_key = get_iso_month(now)
        now_iso = now.isoformat()

        goals_seed = [
            ("Soirée jeux de société sans écrans vendredi soir", "weekly", w_key, 1, None, 15, 0, now_iso),
            ("Faire une balade à vélo de 10 km en famille", "weekly", w_key, 0, papa_id, 15, 0, now_iso),
            ("Cuisiner un gâteau maison avec Léo et Emma", "weekly", w_key, 0, maman_id, 10, 0, now_iso),
            ("Trier les livres et jouets pour faire un don", "weekly", w_key, 0, emma_id, 10, 1, now_iso),
            ("Terminer le livre du moment (Chapitres 4 à 8)", "weekly", w_key, 1, leo_id, 10, 0, now_iso),
            ("Sortie culturelle au Musée d'Histoire Naturelle", "monthly", m_key, 0, None, 25, 0, now_iso),
            ("Bricolage : Installer les étagères de la chambre de Léo", "monthly", m_key, 1, papa_id, 20, 0, now_iso),
            ("Organiser l'album photo familial de l'année", "monthly", m_key, 0, maman_id, 20, 1, now_iso),
            ("Planter des herbes aromatiques sur le balcon", "monthly", m_key, 0, emma_id, 15, 0, now_iso),
        ]
        cur.executemany(
            """
            INSERT INTO goals (title, period_type, period_key, completed, member_id, points_reward, rolled_over_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            goals_seed,
        )

    # Seed 4 Family Recipes ("Recettes")
    cur.execute("SELECT COUNT(*) as cnt FROM recipes")
    if cur.fetchone()["cnt"] == 0:
        recipes_seed = [
            (
                "Tajine de Poulet aux Citrons Confits & Olives",
                "Plat familial",
                20,
                45,
                4,
                make_recipe_svg_data_uri("Tajine Poulet & Citron", "#B45309", "#D97706", "🥘"),
                json.dumps([
                    "4 belles cuisses de poulet fermier",
                    "2 citrons confits au sel (coupés en quartiers)",
                    "150 g d'olives violettes ou vertes dénoyautées",
                    "2 gros oignons jaunes émincés finement",
                    "3 gousses d'ail hachées",
                    "1 c. à café de gingembre moulu",
                    "1 c. à café de curcuma & 1 pincée de pistils de safran",
                    "1 bouquet de coriandre et persil plat ciselés",
                    "3 c. à soupe d'huile d'olive vierge extra",
                    "Sel et poivre du moulin"
                ], ensure_ascii=False),
                json.dumps([
                    "Dans une cocotte ou un plat à tajine, faites chauffer l'huile d'olive à feu moyen et faites dorer les cuisses de poulet sur chaque face pendant 8 minutes.",
                    "Ajoutez les oignons émincés, l'ail haché, le gingembre, le curcuma et le safran. Mélangez délicatement pour bien enrober la viande des épices.",
                    "Mouillez avec un grand verre d'eau chaude (environ 25 cl), ajoutez la moitié des herbes ciselées, couvrez et laissez mijoter à feu doux pendant 30 minutes.",
                    "Rincez les olives et les quartiers de citrons confits à l'eau claire, puis incorporez-les dans le tajine autour du poulet.",
                    "Poursuivez la cuisson à découvert pendant 10 à 15 minutes pour que la sauce réduise et devienne onctueuse.",
                    "Parsemez du reste de coriandre fraîche juste avant de servir bien chaud avec de la semoule ou du pain maison."
                ], ensure_ascii=False),
                json.dumps(["Tradition", "Sans gluten", "Mijoté"], ensure_ascii=False),
            ),
            (
                "Lasagnes Bolognaise Maison Gratinées",
                "Plat principal",
                30,
                40,
                6,
                make_recipe_svg_data_uri("Lasagnes Maison", "#991B1B", "#DC2626", "🍝"),
                json.dumps([
                    "12 feuilles de lasagnes (sèches ou fraîches)",
                    "500 g de bœuf haché du boucher (5% MG)",
                    "800 g de pulpe de tomates concassées",
                    "1 oignon, 2 carottes et 1 branche de céleri en brunoise",
                    "60 g de beurre + 60 g de farine (pour la béchamel)",
                    "75 cl de lait entier tiède",
                    "150 g de mozzarella râpée + 80 g de parmesan fraîchement râpé",
                    "Noix de muscade râpée, origan, laurier, sel et poivre"
                ], ensure_ascii=False),
                json.dumps([
                    "Préparez la sauce bolognaise : faites revenir l'oignon, les carottes et le céleri coupés en petits dés dans un filet d'huile d'olive pendant 5 minutes.",
                    "Ajoutez la viande hachée et faites-la colorer à feu vif en l'émiettant à la spatule en bois.",
                    "Versez la pulpe de tomates, l'origan et une feuille de laurier. Salez, poivrez et laissez mijoter à feu doux 25 minutes.",
                    "Préparez la béchamel : faites fondre le beurre dans une casserole, ajoutez la farine d'un coup, remuez 2 minutes puis versez le lait progressivement en fouettant jusqu'à épaississement. Assaisonnez de sel, poivre et muscade.",
                    "Préchauffez le four à 190°C. Dans un grand plat à gratin, alternez : une fine couche de béchamel, des feuilles de lasagnes, de la sauce bolognaise et du parmesan râpé (3 étages).",
                    "Terminez par une généreuse nappe de béchamel recouverte de mozzarella et de parmesan. Enfournez 35 à 40 minutes jusqu'à obtenir un gratin bien doré."
                ], ensure_ascii=False),
                json.dumps(["Enfants adorent", "Four", "Gourmand"], ensure_ascii=False),
            ),
            (
                "Saumon Rôti au Miel, Citron & Légumes Croquants",
                "Express & Sain",
                15,
                18,
                4,
                make_recipe_svg_data_uri("Saumon Miel & Citron", "#0F766E", "#14B8A6", "🍣"),
                json.dumps([
                    "4 pavés de saumon frais avec peau",
                    "1 tête de brocoli détaillée en petits bouquets",
                    "3 carottes coupées en sifflets fins",
                    "2 courgettes coupées en demi-rondelles",
                    "2 c. à soupe de miel liquide d'acacia",
                    "3 c. à soupe de sauce soja douce ou salée",
                    "Le jus et le zeste d'un citron jaune bio",
                    "1 c. à soupe de graines de sésame doré",
                    "2 c. à soupe d'huile d'olive ou de sésame"
                ], ensure_ascii=False),
                json.dumps([
                    "Préchauffez votre four à 200°C (chaleur tournante) et tapissez une grande plaque de cuisson de papier sulfurisé.",
                    "Dans un bol, fouettez ensemble le miel, la sauce soja, le jus de citron, le zeste et l'huile.",
                    "Disposez les bouquets de brocoli, les carottes et les courgettes tout autour de la plaque, arrosez d'un filet d'huile et enfournez une première fois pendant 8 minutes.",
                    "Sortez la plaque, placez les 4 pavés de saumon au centre et badigeonnez-les généreusement du glaçage miel-citron.",
                    "Enfournez à nouveau pour 10 à 12 minutes selon l'épaisseur des pavés pour garder un cœur fondant.",
                    "Parsemez de graines de sésame grillées dès la sortie du four et servez immédiatement avec du riz basmati."
                ], ensure_ascii=False),
                json.dumps(["Rapide", "Poisson", "Équilibré"], ensure_ascii=False),
            ),
            (
                "Pancakes Moelleux du Dimanche Matin",
                "Petit-déjeuner & Goûter",
                10,
                15,
                4,
                make_recipe_svg_data_uri("Pancakes du Dimanche", "#6D28D9", "#8B5CF6", "🥞"),
                json.dumps([
                    "250 g de farine de blé fluide (T45 ou T55)",
                    "30 g de sucre roux ou cassonade",
                    "1 sachet de levure chimique (11 g)",
                    "2 gros œufs frais à température ambiante",
                    "30 cl de lait demi-écrémé ou végétal",
                    "40 g de beurre fondu tiédi",
                    "1 c. à café d'extrait naturel de vanille",
                    "1 pincée de fleur de sel",
                    "Pour servir : sirop d'érable, myrtilles fraîches, bananes"
                ], ensure_ascii=False),
                json.dumps([
                    "Dans un grand saladier, mélangez au fouet la farine tamisée, le sucre roux, la levure chimique et la pincée de sel.",
                    "Dans un second récipient, battez les œufs entiers avec le lait, l'extrait de vanille et le beurre fondu refroidi.",
                    "Versez les ingrédients liquides au centre des poudres en remuant doucement sans trop travailler la pâte (quelques petits grumeaux garantissent le moelleux).",
                    "Laissez reposer la pâte 10 minutes à température ambiante.",
                    "Chauffez une poêle antiadhésive à feu moyen légèrement beurrée. Versez une petite louche de pâte par pancake.",
                    "Dès que de petites bulles éclatent à la surface (environ 1 min 30), retournez les pancakes et dorez l'autre face 1 minute. Servez bien chauds empilés avec du sirop d'érable et des fruits !"
                ], ensure_ascii=False),
                json.dumps(["Végétarien", "Brunch", "Avec les enfants"], ensure_ascii=False),
            ),
        ]
        cur.executemany(
            """
            INSERT INTO recipes (title, category, prep_time, cook_time, servings, image_url, ingredients_json, steps_json, tags_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            recipes_seed,
        )

    conn.commit()
