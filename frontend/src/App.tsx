import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LayoutGrid,
  Target,
  BookOpen,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  ShieldCheck,
} from 'lucide-react';
import {
  Settings,
  Member,
  DailyTask,
  CalendarEvent,
  GoalsResponse,
  Recipe,
  WeatherData,
  PrayerData,
} from './types';
import { useWakeLock } from './hooks/useWakeLock';
import { HomeBoard } from './components/HomeBoard';
import { GoalsView } from './components/GoalsView';
import { RecipesView } from './components/RecipesView';
import { PinModal } from './components/PinModal';
import { SettingsModal } from './components/SettingsModal';

type ActiveView = 'home' | 'goals' | 'recipes';

const ADMIN_INACTIVITY_TIMEOUT_SECONDS = 120; // 2 minutes

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  theme: 'dark',
  wallpaper_url: '',
  card_opacity: 0.88,
  city: 'Paris',
  country: 'France',
  latitude: 48.8566,
  longitude: 2.3522,
  prayer_method: 12,
  ical_url: '',
};

export function App() {
  // Screen Wake Lock API active permanently on the board & recipe reading mode
  const { isLocked: wakeLockActive } = useWakeLock(true);

  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [settings, setSettings] = useState<Settings>(() => {
    const savedTheme = localStorage.getItem('familyboard_theme') as 'dark' | 'light' | null;
    return {
      ...DEFAULT_SETTINGS,
      theme: savedTheme || 'dark',
    };
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [goalsData, setGoalsData] = useState<GoalsResponse>({
    current_week: '2026-W46',
    current_month: '2026-11',
    weekly: [],
    monthly: [],
  });
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [prayers, setPrayers] = useState<PrayerData | null>(null);

  // =========================================================================
  // 1. SYSTÈME D'UTILISATEUR ACTIF & SESSION ADMIN PERSISTANTE (TIMEOUT 2 MIN)
  // =========================================================================
  const [activeMemberId, setActiveMemberId] = useState<number | null>(null);
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [adminRemainingSeconds, setAdminRemainingSeconds] = useState<number>(0);
  const lastActivityRef = useRef<number>(Date.now());

  const isAdminSession = Boolean(adminPin);

  // Default to the first Child profile (ex: Léo) in non-admin public mode
  const defaultChildMember = useMemo(() => {
    return (
      members.find((m) => !m.role.toLowerCase().includes('parent')) ||
      members[0] ||
      null
    );
  }, [members]);

  const activeMember = useMemo(() => {
    if (activeMemberId) {
      const found = members.find((m) => m.id === activeMemberId);
      if (found) return found;
    }
    return defaultChildMember;
  }, [members, activeMemberId, defaultChildMember]);

  // Logout Admin & revert to default non-admin child profile
  const handleLogoutAdmin = useCallback(() => {
    setAdminPin(null);
    setAdminRemainingSeconds(0);
    setSettingsModalOpen(false);
    if (defaultChildMember) {
      setActiveMemberId(defaultChildMember.id);
    }
  }, [defaultChildMember]);

  // 2-minute inactivity timeout listener based on mousemove, touchstart, click, keydown
  useEffect(() => {
    if (!adminPin) return;

    lastActivityRef.current = Date.now();
    setAdminRemainingSeconds(ADMIN_INACTIVITY_TIMEOUT_SECONDS);

    const resetInactivityTimer = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', resetInactivityTimer, { passive: true });
    window.addEventListener('touchstart', resetInactivityTimer, { passive: true });
    window.addEventListener('click', resetInactivityTimer, { passive: true });
    window.addEventListener('keydown', resetInactivityTimer, { passive: true });

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = ADMIN_INACTIVITY_TIMEOUT_SECONDS - elapsedSeconds;
      if (remaining <= 0) {
        handleLogoutAdmin();
      } else {
        setAdminRemainingSeconds(remaining);
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('touchstart', resetInactivityTimer);
      window.removeEventListener('click', resetInactivityTimer);
      window.removeEventListener('keydown', resetInactivityTimer);
      clearInterval(interval);
    };
  }, [adminPin, handleLogoutAdmin]);

  // Security Parent PIN modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinActionTitle, setPinActionTitle] = useState('Sécurité Parent');
  const [pendingPinCallback, setPendingPinCallback] = useState<
    ((pin: string) => void) | null
  >(null);

  // Settings Modal state (protected by Parent PIN)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Apply Dark/Light theme to <html> root & persist in localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('familyboard_theme', settings.theme);
  }, [settings.theme]);

  const fetchCoreData = useCallback(async () => {
    try {
      const [sRes, mRes, tRes, eRes, gRes, rRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/members'),
        fetch('/api/tasks'),
        fetch('/api/events'),
        fetch('/api/goals'),
        fetch('/api/recipes'),
      ]);

      if (sRes.ok) {
        const sData: Settings = await sRes.json();
        setSettings(sData);
      }
      if (mRes.ok) setMembers(await mRes.json());
      if (tRes.ok) setTasks(await tRes.json());
      if (eRes.ok) setEvents(await eRes.json());
      if (gRes.ok) setGoalsData(await gRes.json());
      if (rRes.ok) setRecipes(await rRes.json());
    } catch (err) {
      console.error('Failed to fetch core board data:', err);
    }
  }, []);

  const fetchExternalData = useCallback(async () => {
    try {
      const [wRes, pRes] = await Promise.all([
        fetch('/api/weather'),
        fetch('/api/prayers'),
      ]);
      if (wRes.ok) setWeather(await wRes.json());
      if (pRes.ok) setPrayers(await pRes.json());
    } catch (err) {
      console.error('Failed to fetch weather/prayers:', err);
    }
  }, []);

  useEffect(() => {
    fetchCoreData();
    fetchExternalData();

    // Refresh weather & prayers every 10 minutes
    const extInterval = setInterval(fetchExternalData, 10 * 60 * 1000);
    return () => clearInterval(extInterval);
  }, [fetchCoreData, fetchExternalData]);

  // Verify PIN against backend
  const verifyPinApi = useCallback(async (pin: string): Promise<boolean> => {
    const res = await fetch('/api/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    return res.ok;
  }, []);

  // Activate Admin session when PIN is verified, and run the action immediately without re-prompting while active
  const runOrRequireAdminSession = (
    title: string,
    action: (verifiedPin: string) => void,
    targetParent?: Member
  ) => {
    if (adminPin) {
      lastActivityRef.current = Date.now();
      if (targetParent) setActiveMemberId(targetParent.id);
      action(adminPin);
      return;
    }

    setPinActionTitle(title);
    setPendingPinCallback(() => (verifiedPin: string) => {
      setPinModalOpen(false);
      setAdminPin(verifiedPin);
      lastActivityRef.current = Date.now();
      setAdminRemainingSeconds(ADMIN_INACTIVITY_TIMEOUT_SECONDS);

      const parentMember =
        targetParent ||
        members.find((m) => m.role.toLowerCase().includes('parent')) ||
        members[0];
      if (parentMember) {
        setActiveMemberId(parentMember.id);
      }
      action(verifiedPin);
    });
    setPinModalOpen(true);
  };

  // Switch to a non-admin profile (e.g. Léo or Emma)
  const handleSelectProfile = (member: Member) => {
    setAdminPin(null);
    setAdminRemainingSeconds(0);
    setActiveMemberId(member.id);
  };

  // Request Admin Login from the top-right profile bar
  const handleRequestAdminLogin = (targetParent?: Member) => {
    const label = targetParent
      ? `Connexion Admin (${targetParent.name})`
      : 'Connexion Administrateur Parent';
    runOrRequireAdminSession(label, () => {}, targetParent);
  };

  // Toggle Theme (Light / Dark) via bottom-right Sun/Moon icon (persisted in SQLite + localStorage)
  const handleToggleTheme = async () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    setSettings((prev) => ({ ...prev, theme: nextTheme }));
    localStorage.setItem('familyboard_theme', nextTheme);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: nextTheme }),
      });
    } catch {
      // Ignored if offline
    }
  };

  // Update Settings
  const handleUpdateSettings = async (partial: Partial<Settings>) => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (res.ok) {
      const updated = await res.json();
      setSettings(updated);
      if (partial.parent_pin && adminPin) {
        setAdminPin(partial.parent_pin);
      }
      if (partial.city || partial.country || partial.prayer_method) {
        await fetchExternalData();
      }
    }
  };

  // =========================================================================
  // 3. WORKFLOW DE VALIDATION PARENTALE OBLIGATOIRE POUR LES TÂCHES
  // =========================================================================
  const handleToggleTask = async (taskId: number) => {
    const targetTask = tasks.find((t) => t.id === taskId);

    // Si un enfant clique sur une tâche déjà validée par un parent, on demande la connexion Admin pour la décocher
    if (!isAdminSession && targetTask?.status === 'validated') {
      runOrRequireAdminSession(
        'Validation Parentale requise pour décocher une tâche validée',
        async (verifiedPin: string) => {
          const res = await fetch(`/api/tasks/${taskId}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_admin: true, pin: verifiedPin }),
          });
          if (res.ok) await fetchCoreData();
        }
      );
      return;
    }

    const res = await fetch(`/api/tasks/${taskId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_admin: isAdminSession,
        pin: adminPin || undefined,
      }),
    });
    if (res.ok) {
      await fetchCoreData();
    }
  };

  // Request Member Points change (No PIN re-entry if Admin session is already active!)
  const handleRequestMemberPoints = (member: Member, delta: number) => {
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    runOrRequireAdminSession(
      `${sign} points pour ${member.name}`,
      async (verifiedPin: string) => {
        const res = await fetch(`/api/members/${member.id}/points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delta, pin: verifiedPin }),
        });
        if (res.ok) {
          await fetchCoreData();
        }
      }
    );
  };

  // Update Member from Settings
  const handleUpdateMember = async (memberId: number, payload: Partial<Member>) => {
    const res = await fetch(`/api/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await fetchCoreData();
    }
  };

  // Tasks CRUD
  const handleCreateTask = async (payload: {
    title: string;
    member_id: number | null;
    days_of_week: number[];
    points_reward: number;
  }) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) await fetchCoreData();
  };

  const handleUpdateTask = async (
    taskId: number,
    payload: {
      title?: string;
      member_id?: number | null;
      days_of_week?: number[];
      points_reward?: number;
    }
  ) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) await fetchCoreData();
  };

  const handleDeleteTask = async (taskId: number) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) await fetchCoreData();
  };

  // Events CRUD & iCal Import
  const handleCreateEvent = async (ev: {
    title: string;
    member_id: number | null;
    category_color: string;
    event_date: string;
    start_time: string;
    end_time: string;
    location: string;
    description: string;
  }) => {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ev),
    });
    if (res.ok) await fetchCoreData();
  };

  const handleDeleteEvent = async (eventId: number) => {
    const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
    if (res.ok) await fetchCoreData();
  };

  const handleImportIcs = async (payload: {
    ical_url?: string;
    ics_text?: string;
    member_id: number | null;
    category_color: string;
  }) => {
    const res = await fetch('/api/events/import-ics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Erreur lors de la synchronisation iCal');
    }
    const data = await res.json();
    await fetchCoreData();
    return data;
  };

  // Goals CRUD & Roll-Over
  const handleToggleGoal = async (goalId: number) => {
    const res = await fetch(`/api/goals/${goalId}/toggle`, { method: 'POST' });
    if (res.ok) await fetchCoreData();
  };

  const handleCreateGoal = async (payload: {
    title: string;
    period_type: 'weekly' | 'monthly';
    member_id: number | null;
    points_reward: number;
  }) => {
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) await fetchCoreData();
  };

  const handleDeleteGoal = async (goalId: number) => {
    const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' });
    if (res.ok) await fetchCoreData();
  };

  const handleSimulateRollover = async () => {
    const res = await fetch('/api/goals/simulate-rollover', { method: 'POST' });
    if (res.ok) await fetchCoreData();
  };

  // Recipes CRUD
  const handleCreateRecipe = async (payload: {
    title: string;
    category: string;
    prep_time: number;
    cook_time: number;
    servings: number;
    image_url: string;
    ingredients: string[];
    steps: string[];
    tags: string[];
  }) => {
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) await fetchCoreData();
  };

  // Adaptive card background style based on Dark/Light mode and custom wallpaper opacity
  const cardStyle = useMemo<React.CSSProperties>(() => {
    const op = settings.wallpaper_url ? settings.card_opacity : 0.96;
    if (settings.theme === 'dark') {
      return {
        backgroundColor: `rgba(30, 30, 30, ${op})`,
      };
    }
    return {
      backgroundColor: `rgba(255, 255, 255, ${op})`,
    };
  }, [settings.theme, settings.wallpaper_url, settings.card_opacity]);

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden flex flex-col justify-between select-none transition-colors duration-300 ${
        settings.theme === 'dark'
          ? 'bg-[#121212] text-white'
          : 'bg-[#F3F4F6] text-gray-900'
      }`}
    >
      {/* Photo de famille / Fond d'écran global personnalisé */}
      {settings.wallpaper_url && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-500"
          style={{ backgroundImage: `url("${settings.wallpaper_url}")` }}
        >
          <div
            className={`absolute inset-0 ${
              settings.theme === 'dark' ? 'bg-black/45' : 'bg-white/30'
            }`}
          />
        </div>
      )}

      {/* ZONE PRINCIPALE (Sans défilement global, occupe tout l'espace au-dessus du dock) */}
      <main className="relative z-10 flex-1 min-h-0 w-full px-5 pt-4 pb-2 overflow-hidden">
        {activeView === 'home' && (
          <HomeBoard
            members={members}
            activeMember={activeMember}
            isAdminSession={isAdminSession}
            adminRemainingSeconds={adminRemainingSeconds}
            onSelectProfile={handleSelectProfile}
            onRequestAdminLogin={handleRequestAdminLogin}
            onLogoutAdmin={handleLogoutAdmin}
            tasks={tasks}
            events={events}
            weather={weather}
            prayers={prayers}
            cardStyle={cardStyle}
            onToggleTask={handleToggleTask}
            onRequestMemberPoints={handleRequestMemberPoints}
            onCreateEvent={handleCreateEvent}
            onDeleteEvent={handleDeleteEvent}
            onImportIcs={handleImportIcs}
          />
        )}

        {activeView === 'goals' && (
          <GoalsView
            goalsData={goalsData}
            members={members}
            cardStyle={cardStyle}
            onToggleGoal={handleToggleGoal}
            onCreateGoal={handleCreateGoal}
            onDeleteGoal={handleDeleteGoal}
            onSimulateRollover={handleSimulateRollover}
          />
        )}

        {activeView === 'recipes' && (
          <RecipesView
            recipes={recipes}
            cardStyle={cardStyle}
            onCreateRecipe={handleCreateRecipe}
          />
        )}
      </main>

      {/* BARRE DE NAVIGATION INFÉRIEURE (Dock centré + boutons d'action à droite, cibles tactiles >= 48px) */}
      <footer className="relative z-20 h-20 px-6 pb-3 flex items-center justify-between shrink-0">
        {/* Indicateur d'état Kiosk, Wake Lock & Session Admin à gauche */}
        <div className="flex items-center gap-2.5 text-sm font-bold">
          {weather?.offline ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-500/15 text-amber-400">
              <WifiOff className="w-4 h-4" /> Cache Local SQLite
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/5 dark:bg-white/5 opacity-75">
              <Wifi className="w-4 h-4 text-emerald-500" />
              {wakeLockActive ? 'Kiosk Actif • Sans veille' : 'Mode Kiosque 16:9'}
            </span>
          )}

          {isAdminSession && (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-extrabold">
              <ShieldCheck className="w-4 h-4" />
              Admin actif 🔒 ({Math.floor(adminRemainingSeconds / 60)}:
              {String(adminRemainingSeconds % 60).padStart(2, '0')})
            </span>
          )}
        </div>

        {/* Dock Centré : 3 Boutons Principaux (Accueil, Objectifs, Recettes) */}
        <nav
          style={cardStyle}
          className="flex items-center gap-2 p-2 rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-md shadow-xl"
        >
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className={`min-h-[48px] inline-flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-extrabold text-base transition-all duration-200 active:scale-95 ${
              activeView === 'home'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                : 'hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            Accueil
          </button>

          <button
            type="button"
            onClick={() => setActiveView('goals')}
            className={`min-h-[48px] inline-flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-extrabold text-base transition-all duration-200 active:scale-95 ${
              activeView === 'goals'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                : 'hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Target className="w-5 h-5" />
            Objectifs
          </button>

          <button
            type="button"
            onClick={() => setActiveView('recipes')}
            className={`min-h-[48px] inline-flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-extrabold text-base transition-all duration-200 active:scale-95 ${
              activeView === 'recipes'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                : 'hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            Recettes
          </button>
        </nav>

        {/* 2 Boutons d'Action à Droite : Paramètres ⚙️ (ouvre direct si session Admin active) & Thème Clair/Sombre 🌓 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              runOrRequireAdminSession('Accès aux Paramètres Parents', () => {
                setSettingsModalOpen(true);
              })
            }
            style={cardStyle}
            className="min-h-[48px] inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-md shadow-lg hover:border-amber-400/60 font-extrabold text-base transition-all duration-200 active:scale-95"
            title="Paramètres (Direct si Admin connecté, sinon Code PIN)"
          >
            <SettingsIcon className="w-5 h-5 text-amber-500" />
            <span>Paramètres</span>
          </button>

          <button
            type="button"
            onClick={handleToggleTheme}
            style={cardStyle}
            className="min-h-[48px] min-w-[48px] p-3 rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-md shadow-lg hover:border-amber-400/60 transition-all duration-200 active:scale-95 flex items-center justify-center"
            aria-label="Basculer Thème Clair / Sombre"
            title={
              settings.theme === 'dark'
                ? 'Passer en Mode Clair (Soleil)'
                : 'Passer en Mode Sombre (Lune)'
            }
          >
            {settings.theme === 'dark' ? (
              <Sun className="w-6 h-6 text-amber-400" />
            ) : (
              <Moon className="w-6 h-6 text-slate-700" />
            )}
          </button>
        </div>
      </footer>

      {/* Modale de Code PIN Parent (4 chiffres, défaut 1234) */}
      <PinModal
        isOpen={pinModalOpen}
        title={pinActionTitle}
        onClose={() => setPinModalOpen(false)}
        onSuccess={(pin) => {
          if (pendingPinCallback) {
            pendingPinCallback(pin);
          }
        }}
        verifyPinApi={verifyPinApi}
      />

      {/* Modale Paramètres (Une fois le PIN validé) */}
      <SettingsModal
        isOpen={settingsModalOpen}
        settings={settings}
        members={members}
        tasks={tasks}
        onClose={() => setSettingsModalOpen(false)}
        onUpdateSettings={handleUpdateSettings}
        onUpdateMember={handleUpdateMember}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />
    </div>
  );
}

export default App;
