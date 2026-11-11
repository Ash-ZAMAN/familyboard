import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  Plus,
  Minus,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  CloudSun,
  Stars,
  MapPin,
  CalendarPlus,
  DownloadCloud,
  Sparkles,
  Wind,
  X,
  Trash2,
  Clock,
  ShieldCheck,
  Lock,
  LogOut,
  Hourglass,
  UserCheck,
  CalendarHeart,
  PartyPopper,
  Trophy,
  ChevronRight,
} from 'lucide-react';
import {
  Member,
  DailyTask,
  CalendarEvent,
  WeatherData,
  PrayerData,
} from '../types';
import { WeatherIcon } from './WeatherIcon';

interface HomeBoardProps {
  members: Member[];
  activeMember: Member | null;
  isAdminSession: boolean;
  adminRemainingSeconds: number;
  onSelectProfile: (member: Member) => void;
  onRequestAdminLogin: (targetParent?: Member) => void;
  onLogoutAdmin: () => void;
  tasks: DailyTask[];
  events: CalendarEvent[];
  weather: WeatherData | null;
  prayers: PrayerData | null;
  cardStyle: React.CSSProperties;
  onToggleTask: (taskId: number) => void;
  onRequestMemberPoints: (member: Member, delta: number) => void;
  onCreateEvent: (ev: {
    title: string;
    member_id: number | null;
    category_color: string;
    event_date: string;
    start_time: string;
    end_time: string;
    location: string;
    description: string;
  }) => Promise<void>;
  onDeleteEvent: (eventId: number) => Promise<void>;
  onImportIcs: (payload: {
    ical_url?: string;
    ics_text?: string;
    member_id: number | null;
    category_color: string;
  }) => Promise<{ imported: number }>;
}

const FRENCH_DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const HomeBoard: React.FC<HomeBoardProps> = ({
  members,
  activeMember,
  isAdminSession,
  adminRemainingSeconds,
  onSelectProfile,
  onRequestAdminLogin,
  onLogoutAdmin,
  tasks,
  events,
  weather,
  prayers,
  cardStyle,
  onToggleTask,
  onRequestMemberPoints,
  onCreateEvent,
  onDeleteEvent,
  onImportIcs,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [selectedMemberForPoints, setSelectedMemberForPoints] = useState<Member | null>(null);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showIcsModal, setShowIcsModal] = useState(false);
  const [filterTodayOnly, setFilterTodayOnly] = useState(true);

  // Event form state
  const [evTitle, setEvTitle] = useState('');
  const [evMemberId, setEvMemberId] = useState<number | null>(null);
  const [evColor, setEvColor] = useState('#3B82F6');
  const [evDate, setEvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [evStart, setEvStart] = useState('17:30');
  const [evEnd, setEvEnd] = useState('19:00');
  const [evLocation, setEvLocation] = useState('');

  // ICS import state
  const [icsUrl, setIcsUrl] = useState('');
  const [icsText, setIcsText] = useState('');
  const [icsMemberId, setIcsMemberId] = useState<number | null>(null);
  const [icsStatus, setIcsStatus] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format real-time clock HH:MM and French full date (ex: "Mardi 10 Novembre")
  const timeString = useMemo(() => {
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }, [now]);

  const dateFrenchString = useMemo(() => {
    const raw = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(now);
    return raw
      .split(' ')
      .map((word) => (word.length > 2 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }, [now]);

  // Day of week index (0 = Lundi .. 6 = Dimanche)
  const todayWeekdayIndex = useMemo(() => {
    const jsDay = now.getDay(); // 0=Sun..6=Sat
    return jsDay === 0 ? 6 : jsDay - 1;
  }, [now]);

  const visibleTasks = useMemo(() => {
    if (!filterTodayOnly) return tasks;
    return tasks.filter((t) => t.days_of_week.includes(todayWeekdayIndex));
  }, [tasks, filterTodayOnly, todayWeekdayIndex]);

  const validatedCount = useMemo(
    () => visibleTasks.filter((t) => t.status === 'validated').length,
    [visibleTasks]
  );
  const pendingCount = useMemo(
    () => visibleTasks.filter((t) => t.status === 'pending').length,
    [visibleTasks]
  );
  const taskCompletionPct = useMemo(
    () =>
      visibleTasks.length > 0
        ? Math.round((validatedCount / visibleTasks.length) * 100)
        : 100,
    [validatedCount, visibleTasks.length]
  );

  // Format admin countdown MM:SS
  const adminTimerFormatted = useMemo(() => {
    const mins = Math.floor(adminRemainingSeconds / 60);
    const secs = adminRemainingSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, [adminRemainingSeconds]);

  // Determine Next Prayer dynamically compared to current time
  const prayerOrder: Array<{
    key: keyof PrayerData['timings'];
    label: string;
    subtitle: string;
  }> = [
    { key: 'Fajr', label: 'Fajr', subtitle: 'Aube' },
    { key: 'Dhuhr', label: 'Dhuhr', subtitle: 'Midi' },
    { key: 'Asr', label: 'Asr', subtitle: 'Après-midi' },
    { key: 'Maghrib', label: 'Maghrib', subtitle: 'Coucher' },
    { key: 'Isha', label: 'Isha', subtitle: 'Nuit' },
  ];

  const renderPrayerIcon = (key: keyof PrayerData['timings'], isNext: boolean) => {
    const cls = `w-6 h-6 ${isNext ? 'text-amber-400' : 'text-amber-500/85'}`;
    switch (key) {
      case 'Fajr':
        return <Sunrise className={cls} />;
      case 'Dhuhr':
        return <Sun className={cls} />;
      case 'Asr':
        return <CloudSun className={cls} />;
      case 'Maghrib':
        return <Sunset className={cls} />;
      case 'Isha':
        return <Stars className={cls} />;
    }
  };

  const nextPrayerInfo = useMemo(() => {
    if (!prayers?.timings) return { key: 'Maghrib', time: '17:25', isTomorrow: false };
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const p of prayerOrder) {
      const tStr = prayers.timings[p.key];
      if (!tStr) continue;
      const [hh, mm] = tStr.split(':').map((n) => parseInt(n, 10));
      const pMinutes = hh * 60 + mm;
      if (pMinutes > currentMinutes) {
        return { key: p.key, time: tStr, isTomorrow: false };
      }
    }
    return {
      key: 'Fajr',
      time: prayers.timings.Fajr || '06:18',
      isTomorrow: true,
    };
  }, [prayers, now]);

  const formatEventDayLabel = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const todayStr = now.toISOString().slice(0, 10);
      if (dateStr === todayStr) return "Aujourd'hui";
      const label = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(dt);
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
      return dateStr;
    }
  };

  const handleAddEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim()) return;
    const chosenMember = members.find((m) => m.id === evMemberId);
    await onCreateEvent({
      title: evTitle.trim(),
      member_id: evMemberId,
      category_color: chosenMember ? chosenMember.color : evColor,
      event_date: evDate,
      start_time: evStart,
      end_time: evEnd,
      location: evLocation.trim(),
      description: '',
    });
    setEvTitle('');
    setEvLocation('');
    setShowAddEventModal(false);
  };

  const handleIcsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIcsStatus('Synchronisation en cours...');
    try {
      const chosenMember = members.find((m) => m.id === icsMemberId);
      const res = await onImportIcs({
        ical_url: icsUrl.trim() || undefined,
        ics_text: icsText.trim() || undefined,
        member_id: icsMemberId,
        category_color: chosenMember ? chosenMember.color : '#10B981',
      });
      setIcsStatus(`${res.imported} événement(s) importé(s) avec succès !`);
      setTimeout(() => {
        setShowIcsModal(false);
        setIcsStatus(null);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur import iCal';
      setIcsStatus(msg);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-full w-full overflow-hidden">
      {/* =====================================================================
          COLONNE A (GAUCHE) : Horloge, Météo & La liste du jour (4 cols)
      ===================================================================== */}
      <div className="col-span-4 flex flex-col gap-4 h-full min-h-0">
        {/* Carte 1 : Horloge Temps Réel & Météo 5 Heures (Bento Glassmorphism) */}
        <section
          style={cardStyle}
          className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-md p-5 shadow-lg shrink-0 flex flex-col justify-between"
        >
          {/* Halo décoratif subtil */}
          <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-amber-500/10 blur-2xl" />

          {/* Horloge & Date en Français */}
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="text-6xl font-black tracking-tight leading-none tabular-nums">
                {timeString}
              </div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                {dateFrenchString}
              </div>
            </div>

            {/* Météo actuelle lisible à distance */}
            {weather && (
              <div className="flex flex-col items-end text-right">
                <div className="flex items-center gap-2.5">
                  <WeatherIcon name={weather.current.icon} className="w-11 h-11" />
                  <span className="text-4xl font-black tabular-nums">
                    {weather.current.temp}°
                  </span>
                </div>
                <span className="text-base font-bold text-gray-700 dark:text-gray-200 mt-1">
                  {weather.current.description}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                  <MapPin className="w-4 h-4 text-amber-500" />
                  {weather.city} • <Wind className="w-4 h-4" /> {weather.current.wind_kmh} km/h
                </span>
              </div>
            )}
          </div>

          {/* Prévisions des 5 prochaines heures alignées horizontalement */}
          {weather && weather.hourly.length > 0 && (
            <div className="relative mt-4 pt-3.5 border-t border-black/10 dark:border-white/10 grid grid-cols-5 gap-2">
              {weather.hourly.slice(0, 5).map((h, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center justify-center py-2 px-1.5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 transition-all duration-200 hover:bg-black/[0.07] dark:hover:bg-white/[0.09]"
                >
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                    {h.time}
                  </span>
                  <div className="my-1.5">
                    <WeatherIcon name={h.icon} className="w-6 h-6" />
                  </div>
                  <span className="text-base font-extrabold tabular-nums">{h.temp}°</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Carte 2 : La liste du jour (Workflow de Validation Parentale + Barre de progression) */}
        <section
          style={cardStyle}
          className="rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-md p-5 shadow-lg flex-1 min-h-0 flex flex-col"
        >
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-emerald-500" />
                La liste du jour
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 mt-1">
                <span>
                  {validatedCount} sur {visibleTasks.length} validées ✅
                </span>
                {pendingCount > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold border border-amber-500/40">
                    {pendingCount} en attente ⏳
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                    Aucune attente 🎉
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFilterTodayOnly((v) => !v)}
              className="min-h-[44px] px-4 py-2 rounded-2xl text-sm font-bold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition-all duration-200 active:scale-95"
            >
              {filterTodayOnly ? "Aujourd'hui" : 'Tous les jours'}
            </button>
          </div>

          {/* Barre de progression globale des tâches du jour */}
          <div className="w-full h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-3.5 shrink-0">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${taskCompletionPct}%` }}
            />
          </div>

          {/* Liste des tâches ou Empty State éloquent */}
          <div className="flex-1 overflow-y-auto kiosk-scroll space-y-2.5 pr-1">
            {visibleTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-dashed border-black/10 dark:border-white/10">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-3">
                  <PartyPopper className="w-9 h-9" />
                </div>
                <h3 className="text-lg font-extrabold">
                  Aucune tâche prévue aujourd'hui ! 🎉
                </h3>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                  Tout est calme et parfaitement à jour. Profitez bien de cette journée en famille !
                </p>
              </div>
            ) : (
              visibleTasks.map((task) => {
                const isValidated = task.status === 'validated';
                const isPending = task.status === 'pending';

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onToggleTask(task.id)}
                    className={`w-full text-left flex items-center justify-between gap-3.5 p-3.5 rounded-2xl border transition-all duration-200 active:scale-[0.99] min-h-[68px] ${
                      isValidated
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-gray-400 dark:text-gray-500'
                        : isPending
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-950 dark:text-amber-100 shadow-md'
                        : 'bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border-black/5 dark:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Cible tactile large (44x44px) : Grise -> Orange Sablier -> Verte Validée */}
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                          isValidated
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 animate-check-pop'
                            : isPending
                            ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30 animate-pulse'
                            : 'border-2 border-gray-400/70 dark:border-white/35 bg-transparent hover:border-amber-400'
                        }`}
                      >
                        {isValidated && <Check className="w-6 h-6 stroke-[3]" />}
                        {isPending && <Hourglass className="w-5 h-5 stroke-[2.5]" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className={`text-lg font-bold truncate transition-all ${
                              isValidated ? 'line-through opacity-75' : ''
                            }`}
                          >
                            {task.title}
                          </div>

                          {isPending && (
                            <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-extrabold bg-amber-500 text-black shadow-sm">
                              {isAdminSession
                                ? 'Valider ✅'
                                : 'En attente parent ⏳'}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {task.member_name ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-bold text-white"
                              style={{ backgroundColor: task.member_color || '#3B82F6' }}
                            >
                              {task.member_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-500">
                              Famille
                            </span>
                          )}
                          <span
                            className={`text-sm font-bold ${
                              isPending
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            +{task.points_reward} pts
                          </span>
                          <div className="flex items-center gap-1 ml-auto">
                            {FRENCH_DAYS_SHORT.map((dLabel, idx) => {
                              const active = task.days_of_week.includes(idx);
                              return (
                                <span
                                  key={idx}
                                  className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                                    active
                                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                                      : 'opacity-25'
                                  }`}
                                >
                                  {dLabel}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* =====================================================================
          COLONNE B (CENTRALE) : L'agenda de la semaine (4 cols)
      ===================================================================== */}
      <div className="col-span-4 h-full min-h-0 flex flex-col">
        <section
          style={cardStyle}
          className="rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-md p-5 shadow-lg h-full min-h-0 flex flex-col"
        >
          <div className="flex items-center justify-between gap-2 mb-3.5 shrink-0">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                L'agenda de la semaine
              </h2>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                Planning familial unifié & code couleur par membre
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowIcsModal(true)}
                className="min-h-[44px] min-w-[44px] p-3 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-all duration-200 active:scale-95 flex items-center justify-center"
                title="Importer un flux iCal / ICS (Google Calendar, Outlook)"
              >
                <DownloadCloud className="w-5 h-5 text-sky-400" />
              </button>
              <button
                type="button"
                onClick={() => setShowAddEventModal(true)}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/25 transition-all duration-200 active:scale-95"
              >
                <CalendarPlus className="w-5 h-5" />
                Ajouter
              </button>
            </div>
          </div>

          {/* Légende rapide des membres */}
          <div className="flex items-center gap-2 mb-3.5 overflow-x-auto pb-1 shrink-0">
            {members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border border-black/5 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05]"
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.name}
              </span>
            ))}
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border border-black/5 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05]">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              Famille
            </span>
          </div>

          {/* Liste des cartes d'événements ou Empty State éloquent */}
          <div className="flex-1 overflow-y-auto kiosk-scroll space-y-3 pr-1">
            {events.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-dashed border-black/10 dark:border-white/10">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-3">
                  <CalendarHeart className="w-9 h-9" />
                </div>
                <h3 className="text-lg font-extrabold">
                  Aucun événement prévu cette semaine ! ✨
                </h3>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                  Ajoutez une sortie en famille, une activité sportive ou synchronisez votre agenda iCal.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(true)}
                  className="mt-4 min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-base shadow-md transition-all duration-200 active:scale-95"
                >
                  <CalendarPlus className="w-5 h-5" />
                  Planifier un événement
                </button>
              </div>
            ) : (
              events.map((ev) => {
                const color = ev.member_color || ev.category_color || '#10B981';
                return (
                  <div
                    key={ev.id}
                    className="group relative rounded-2xl p-4 transition-all duration-200 hover:scale-[1.01] flex items-stretch justify-between gap-3.5 overflow-hidden shadow-md"
                    style={{
                      backgroundColor: `${color}22`,
                      border: `1px solid ${color}50`,
                    }}
                  >
                    {/* Barre verticale accentuée à gauche */}
                    <div
                      className="w-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-sm font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-lg"
                          style={{
                            backgroundColor: `${color}30`,
                            color: color,
                          }}
                        >
                          {formatEventDayLabel(ev.event_date)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-extrabold tabular-nums">
                          <Clock className="w-4 h-4" style={{ color }} />
                          {ev.start_time} – {ev.end_time}
                        </span>
                      </div>

                      <div className="text-lg font-extrabold mt-1.5 truncate">
                        {ev.title}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="flex items-center gap-2 text-sm font-semibold opacity-90 truncate">
                          {ev.location && (
                            <span className="inline-flex items-center gap-1.5 truncate">
                              <MapPin className="w-4 h-4 shrink-0" style={{ color }} />
                              {ev.location}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ev.member_name ? (
                            <span
                              className="px-3 py-1 rounded-full text-sm font-bold text-white shadow-sm"
                              style={{ backgroundColor: color }}
                            >
                              {ev.member_name}
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-sm font-bold bg-emerald-500 text-white">
                              Famille
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setEventToDelete(ev)}
                            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-red-500/25 text-gray-600 dark:text-gray-200 hover:text-red-400 transition-all duration-200 active:scale-95 flex items-center justify-center"
                            title="Supprimer cet événement"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* =====================================================================
          COLONNE C (DROITE) :
          - En-tête : Zone Utilisateur Refondue (Avatar Large w-16 h-16, Statut & Rôle)
          - Milieu : Progression de la Famille (Grille 2x2 Bento avec Dégradés)
          - Bas : Horaires de Prière en Grille de Cases ("Cards")
      ===================================================================== */}
      <div className="col-span-4 flex flex-col gap-3.5 h-full min-h-0">
        {/* 0. ZONE UTILISATEUR EN HAUT À DROITE (Avatar large w-16 h-16, Statut & Rôle, Cible tactile large) */}
        <section
          style={cardStyle}
          className={`rounded-2xl border backdrop-blur-md p-3.5 shadow-lg shrink-0 transition-all duration-200 ${
            isAdminSession
              ? 'border-emerald-500/50 bg-emerald-500/[0.08]'
              : 'border-black/10 dark:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Zone de clic large et confortable pour basculer de profil */}
            <button
              type="button"
              onClick={() => setShowProfileSwitcher(true)}
              className="flex items-center gap-3.5 min-w-0 flex-1 text-left p-1.5 -m-1.5 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 active:scale-[0.99]"
              title="Touchez pour changer de profil ou passer en Mode Parent Admin"
            >
              <div className="relative shrink-0">
                {activeMember ? (
                  <img
                    src={activeMember.avatar}
                    alt={activeMember.name}
                    className="w-16 h-16 rounded-full object-cover border-[3px] shadow-xl transition-transform duration-200"
                    style={{
                      borderColor: activeMember.color,
                      boxShadow: `0 6px 20px -4px ${activeMember.color}66`,
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-black text-2xl">
                    ?
                  </div>
                )}
                {/* Pastille d'état de session */}
                <span
                  className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-[#1E1E1E] ${
                    isAdminSession ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-xl tracking-tight truncate">
                    {activeMember ? activeMember.name : 'Famille'}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-extrabold tracking-wide shadow-sm ${
                      isAdminSession
                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isAdminSession ? 'Mode Admin actif 🔒' : 'Mode Enfant 👤'}
                  </span>
                </div>
                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate mt-1 flex items-center gap-1">
                  <span>
                    {isAdminSession
                      ? `Déverrouillé • Veille auto dans ${adminTimerFormatted}`
                      : 'Touchez ici pour changer de profil'}
                  </span>
                  <ChevronRight className="w-4 h-4 opacity-70 shrink-0" />
                </div>
              </div>
            </button>

            {/* Bouton Connexion Admin / Verrouillage Tactile Large (min 44x44px) */}
            <div className="flex items-center gap-2 shrink-0">
              {isAdminSession ? (
                <>
                  <div
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-base font-extrabold tabular-nums"
                    title="Temps restant avant déconnexion automatique (2 min d'inactivité)"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span>{adminTimerFormatted}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onLogoutAdmin}
                    className="min-h-[44px] min-w-[44px] p-3 rounded-2xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-all duration-200 active:scale-95 flex items-center justify-center"
                    title="Verrouiller la session Admin maintenant"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onRequestAdminLogin()}
                  className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm shadow-md shadow-amber-500/25 transition-all duration-200 active:scale-95"
                  title="Connexion Parent Administrateur (Code PIN)"
                >
                  <Lock className="w-4 h-4" />
                  <span>PIN Parent</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 1. MOITIÉ SUPÉRIEURE : Progression de la Famille (Grille 2x2 Bento) */}
        <section
          style={cardStyle}
          className="flex-1 min-h-0 rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-md p-4 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Progression de la famille
            </h2>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
              {isAdminSession ? 'Modification directe active' : 'Objectif 50 pts'}
            </span>
          </div>

          {/* Grille 2x2 Compacte avec cibles tactiles confortables */}
          <div className="grid grid-cols-2 grid-rows-2 gap-2.5 flex-1 min-h-0">
            {members.slice(0, 4).map((member) => {
              const pct = Math.min(
                100,
                Math.round((member.points / Math.max(1, member.goal_points)) * 100)
              );
              const isCurrentActive = activeMember?.id === member.id;
              return (
                <div
                  key={member.id}
                  onClick={() => setSelectedMemberForPoints(member)}
                  role="button"
                  tabIndex={0}
                  className={`rounded-2xl p-3 bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08] border transition-all duration-200 active:scale-[0.98] flex flex-col justify-between cursor-pointer ${
                    isCurrentActive
                      ? 'border-amber-500/60 shadow-md'
                      : 'border-black/5 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-11 h-11 rounded-full object-cover border-2 shrink-0 shadow-sm"
                        style={{ borderColor: member.color }}
                      />
                      <div className="min-w-0">
                        <div className="font-extrabold text-base truncate leading-tight">
                          {member.name}
                        </div>
                        <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate">
                          {member.role}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestMemberPoints(member, -5);
                        }}
                        className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-all duration-200 active:scale-90"
                        title="Retirer 5 points"
                      >
                        <Minus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestMemberPoints(member, 5);
                        }}
                        className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center justify-center transition-all duration-200 active:scale-90"
                        title="Ajouter 5 points"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Jauge de progression horizontale colorée + score lisible */}
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between text-sm font-extrabold mb-1">
                      <span style={{ color: member.color }}>{pct}%</span>
                      <span className="tabular-nums">
                        {member.points}/{member.goal_points} pts
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundImage: `linear-gradient(90deg, ${member.color}cc, ${member.color})`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. MOITIÉ INFÉRIEURE : Horaires de Prière en Grille de Cases ("Cards") */}
        <section
          style={cardStyle}
          className="flex-1 min-h-0 rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-md p-4 shadow-lg flex flex-col justify-between"
        >
          {/* En-tête avec titre "Horaires de prière" et icône de croissant de lune en haut à droite */}
          <div className="flex items-center justify-between gap-2 mb-2.5 shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
                Horaires de prière
              </h2>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate">
                {prayers ? `${prayers.city}, ${prayers.country}` : 'Paris, France'}
                {prayers?.hijri_label ? ` • ${prayers.hijri_label}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1 rounded-full text-sm font-extrabold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                {nextPrayerInfo.key} • {nextPrayerInfo.time}
              </span>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Moon className="w-5 h-5 fill-amber-400/20" />
              </div>
            </div>
          </div>

          {/* Grille moderne de 5 Cases rectangulaires (Cards) pour Fajr, Dhuhr, Asr, Maghrib, Isha */}
          <div className="grid grid-cols-6 grid-rows-2 gap-2.5 flex-1 min-h-0">
            {prayerOrder.map(({ key, label, subtitle }, index) => {
              const timeVal = prayers?.timings?.[key] || '--:--';
              const isNext = nextPrayerInfo.key === key;
              // Top row: 3 cards (col-span-2 each). Bottom row: 2 cards (col-span-3 each).
              const spanClass = index < 3 ? 'col-span-2' : 'col-span-3';

              return (
                <div
                  key={key}
                  className={`${spanClass} rounded-2xl px-3.5 py-2.5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                    isNext
                      ? 'bg-gradient-to-br from-amber-500/25 via-amber-500/15 to-transparent border-2 border-amber-400 text-amber-500 dark:text-amber-300 prayer-next-glow shadow-lg'
                      : 'bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {renderPrayerIcon(key, isNext)}
                      <span className="text-base font-extrabold tracking-wide truncate">
                        {label}
                      </span>
                    </div>

                    {isNext ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-black text-xs font-black uppercase tracking-wide shrink-0">
                        <span className="w-2 h-2 rounded-full bg-black animate-ping" />
                        Prochaine
                      </span>
                    ) : (
                      <span className="text-sm font-semibold opacity-60 truncate">
                        {subtitle}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between mt-1">
                    <span
                      className={`text-2xl font-black tabular-nums tracking-tight leading-none ${
                        isNext ? 'text-amber-500 dark:text-amber-300' : ''
                      }`}
                    >
                      {timeVal}
                    </span>
                    {isNext && (
                      <span className="text-sm font-bold text-amber-500 dark:text-amber-300">
                        À venir
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Modale de sélection du profil actif / Connexion Admin Parent */}
      {showProfileSwitcher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#1E1E1E] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold">Qui utilise le tableau ?</h3>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Les profils Parents activent la session Administrateur (timeout 2 min)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileSwitcher(false)}
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {members.map((m) => {
                const isParent = m.role.toLowerCase().includes('parent');
                const isSelected = activeMember?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setShowProfileSwitcher(false);
                      if (isParent) {
                        onRequestAdminLogin(m);
                      } else {
                        onSelectProfile(m);
                      }
                    }}
                    className={`p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all duration-200 active:scale-95 ${
                      isSelected
                        ? 'bg-amber-500/15 border-2 border-amber-500 shadow-md'
                        : 'bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.07] dark:hover:bg-white/[0.08] border-black/10 dark:border-white/10'
                    }`}
                  >
                    <img
                      src={m.avatar}
                      alt={m.name}
                      className="w-14 h-14 rounded-full object-cover border-2 shrink-0"
                      style={{ borderColor: m.color }}
                    />
                    <div className="min-w-0">
                      <div className="font-extrabold text-lg truncate">{m.name}</div>
                      <div className="flex items-center gap-1.5 text-sm font-bold mt-1">
                        {isParent ? (
                          <span className="inline-flex items-center gap-1 text-amber-500">
                            <Lock className="w-4 h-4" /> Parent 🔒
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">
                            Enfant 👤
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {isAdminSession && (
              <div className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                <span className="text-base font-bold text-emerald-500">
                  Session Admin active ({adminTimerFormatted} restantes)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileSwitcher(false);
                    onLogoutAdmin();
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-2xl bg-red-500/15 text-red-400 text-sm font-extrabold hover:bg-red-500/25 transition"
                >
                  Verrouiller Admin
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale rapide d'ajustement des points d'un membre */}
      {selectedMemberForPoints && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1E1E1E] border border-black/10 dark:border-white/10 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={selectedMemberForPoints.avatar}
                  alt={selectedMemberForPoints.name}
                  className="w-16 h-16 rounded-full border-2"
                  style={{ borderColor: selectedMemberForPoints.color }}
                />
                <div>
                  <h3 className="text-2xl font-extrabold">{selectedMemberForPoints.name}</h3>
                  <p className="text-base font-semibold text-gray-500 dark:text-gray-400">
                    Score actuel : {selectedMemberForPoints.points} / {selectedMemberForPoints.goal_points} pts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMemberForPoints(null)}
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-base font-medium text-gray-500 dark:text-gray-400 mb-4">
              {isAdminSession
                ? 'Session Admin active : touchez pour créditer ou retirer des points immédiatement.'
                : 'Choisissez le nombre de points à attribuer ou retirer (le code PIN Parent sera demandé) :'}
            </p>

            <div className="grid grid-cols-2 gap-3.5">
              {[-10, -5, +5, +10].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => {
                    const m = selectedMemberForPoints;
                    setSelectedMemberForPoints(null);
                    onRequestMemberPoints(m, delta);
                  }}
                  className={`min-h-[56px] py-4 rounded-2xl font-extrabold text-lg transition-all duration-200 active:scale-95 border ${
                    delta > 0
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 border-emerald-500/30'
                      : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/30'
                  }`}
                >
                  {delta > 0 ? `+${delta} points 🌟` : `${delta} points`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modale d'ajout d'événement dans l'agenda */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddEventSubmit}
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#1E1E1E] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-extrabold">Nouvel événement familial</h3>
              <button
                type="button"
                onClick={() => setShowAddEventModal(false)}
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Titre de l'événement
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Foot - Léo, Dentiste - Emma..."
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-base font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Membre concerné
                </label>
                <select
                  value={evMemberId ?? ''}
                  onChange={(e) =>
                    setEvMemberId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-full px-3.5 py-3 rounded-2xl bg-black/5 dark:bg-[#2A2A2A] border border-black/10 dark:border-white/10 text-base font-semibold"
                >
                  <option value="">Toute la famille (Vert)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={evDate}
                  onChange={(e) => setEvDate(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-base font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Heure début
                </label>
                <input
                  type="time"
                  required
                  value={evStart}
                  onChange={(e) => setEvStart(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-base font-semibold"
                />
              </div>
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Heure fin
                </label>
                <input
                  type="time"
                  required
                  value={evEnd}
                  onChange={(e) => setEvEnd(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-base font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Lieu (optionnel)
              </label>
              <input
                type="text"
                placeholder="Ex: Stade Municipal, Cabinet médical..."
                value={evLocation}
                onChange={(e) => setEvLocation(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-base font-semibold"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddEventModal(false)}
                className="min-h-[48px] px-5 py-3 rounded-2xl font-bold text-base bg-black/5 dark:bg-white/10"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="min-h-[48px] px-6 py-3 rounded-2xl font-bold text-base bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modale d'importation iCal / ICS (Google Calendar / Outlook) */}
      {showIcsModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleIcsSubmit}
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#1E1E1E] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-extrabold">
                Synchronisation Calendrier iCal / ICS
              </h3>
              <button
                type="button"
                onClick={() => setShowIcsModal(false)}
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-wider opacity-80 mb-1.5">
                URL du flux iCal (Google Calendar / Outlook / Apple)
              </label>
              <input
                type="url"
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Ou collez directement le contenu d'un fichier .ics
              </label>
              <textarea
                rows={4}
                placeholder="BEGIN:VCALENDAR&#10;BEGIN:VEVENT&#10;SUMMARY:Réunion Parents-Profs&#10;DTSTART:20261112T180000&#10;END:VEVENT&#10;END:VCALENDAR"
                value={icsText}
                onChange={(e) => setIcsText(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Associer au membre
              </label>
              <select
                value={icsMemberId ?? ''}
                onChange={(e) =>
                  setIcsMemberId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full px-4 py-3 rounded-2xl bg-black/5 dark:bg-[#2A2A2A] border border-black/10 dark:border-white/10 font-semibold text-base"
              >
                <option value="">Toute la famille</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {icsStatus && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 text-amber-400 text-base font-bold">
                {icsStatus}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowIcsModal(false)}
                className="min-h-[48px] px-5 py-2.5 rounded-2xl font-bold text-base bg-black/5 dark:bg-white/10"
              >
                Fermer
              </button>
              <button
                type="submit"
                className="min-h-[48px] px-6 py-2.5 rounded-2xl font-bold text-base bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/25"
              >
                Importer le flux
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modale de validation (confirmation) avant la suppression d'un événement */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1E1E1E] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                  <Trash2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold">Supprimer l'événement ?</h3>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                    Cette action retirera l'événement de l'agenda familial.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                className="min-h-[44px] min-w-[44px] p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/10">
              <div className="text-lg font-extrabold">{eventToDelete.title}</div>
              <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                <span>{formatEventDayLabel(eventToDelete.event_date)}</span>
                <span>•</span>
                <span>
                  {eventToDelete.start_time} – {eventToDelete.end_time}
                </span>
                {eventToDelete.member_name && (
                  <>
                    <span>•</span>
                    <span className="font-bold">{eventToDelete.member_name}</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                className="min-h-[52px] py-3.5 rounded-2xl font-extrabold text-base bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition-all duration-200 active:scale-95"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = eventToDelete.id;
                  setEventToDelete(null);
                  await onDeleteEvent(id);
                }}
                className="min-h-[52px] py-3.5 rounded-2xl font-extrabold text-base bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25 transition-all duration-200 active:scale-95"
              >
                Oui, supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
