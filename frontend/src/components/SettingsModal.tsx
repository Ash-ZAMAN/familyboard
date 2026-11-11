import React, { useState } from 'react';
import {
  X,
  Users,
  MapPin,
  ListChecks,
  Image as ImageIcon,
  Shield,
  Plus,
  Trash2,
  Check,
  Upload,
} from 'lucide-react';
import { Settings, Member, DailyTask } from '../types';
import { AvatarCropper } from './AvatarCropper';

interface SettingsModalProps {
  isOpen: boolean;
  settings: Settings;
  members: Member[];
  tasks: DailyTask[];
  onClose: () => void;
  onUpdateSettings: (partial: Partial<Settings>) => Promise<void>;
  onUpdateMember: (memberId: number, payload: Partial<Member>) => Promise<void>;
  onCreateTask: (payload: {
    title: string;
    member_id: number | null;
    days_of_week: number[];
    points_reward: number;
  }) => Promise<void>;
  onUpdateTask: (
    taskId: number,
    payload: {
      title?: string;
      member_id?: number | null;
      days_of_week?: number[];
      points_reward?: number;
    }
  ) => Promise<void>;
  onDeleteTask: (taskId: number) => Promise<void>;
}

const DAY_LABELS = [
  { idx: 0, short: 'Lun' },
  { idx: 1, short: 'Mar' },
  { idx: 2, short: 'Mer' },
  { idx: 3, short: 'Jeu' },
  { idx: 4, short: 'Ven' },
  { idx: 5, short: 'Sam' },
  { idx: 6, short: 'Dim' },
];

const WALLPAPER_PRESETS = [
  { label: 'Aucun (Fond uni Kiosque)', url: '' },
  {
    label: 'Montagnes Crépuscule (SVG)',
    url:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="55%" stop-color="#1e1b4b"/>
            <stop offset="100%" stop-color="#431407"/>
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#sky)"/>
        <circle cx="1480" cy="240" r="90" fill="#f59e0b" opacity="0.25"/>
        <polygon points="0,1080 0,680 420,420 880,760 1360,390 1920,700 1920,1080" fill="#1e293b" opacity="0.7"/>
        <polygon points="0,1080 280,620 790,840 1220,520 1690,790 1920,640 1920,1080" fill="#0f172a" opacity="0.9"/>
      </svg>`),
  },
  {
    label: 'Aurore Boréale Douce (SVG)',
    url:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#042f2e"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e1b4b"/>
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#bg)"/>
        <circle cx="400" cy="300" r="450" fill="#10b981" opacity="0.12"/>
        <circle cx="1500" cy="700" r="520" fill="#6366f1" opacity="0.14"/>
      </svg>`),
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  members,
  tasks,
  onClose,
  onUpdateSettings,
  onUpdateMember,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'tasks' | 'location' | 'appearance'>(
    'members'
  );

  // Location & Prayer state
  const [city, setCity] = useState(settings.city);
  const [country, setCountry] = useState(settings.country);
  const [prayerMethod, setPrayerMethod] = useState(settings.prayer_method);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // New routine task state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskMember, setNewTaskMember] = useState<number | null>(null);
  const [newTaskPoints, setNewTaskPoints] = useState(5);
  const [newTaskDays, setNewTaskDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Appearance & PIN state
  const [wallpaperUrl, setWallpaperUrl] = useState(settings.wallpaper_url);
  const [cardOpacity, setCardOpacity] = useState(settings.card_opacity);
  const [newPin, setNewPin] = useState('');

  if (!isOpen) return null;

  const flashSaved = (msg = 'Modifications enregistrées !') => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 2200);
  };

  const handleLocationSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSettings({
      city: city.trim() || 'Paris',
      country: country.trim() || 'France',
      prayer_method: Number(prayerMethod),
    });
    flashSaved('Ville météo & prières mise à jour !');
  };

  const handleAppearanceSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Settings> = {
      wallpaper_url: wallpaperUrl,
      card_opacity: cardOpacity,
    };
    if (newPin.trim().length === 4 && /^\d{4}$/.test(newPin.trim())) {
      payload.parent_pin = newPin.trim();
    }
    await onUpdateSettings(payload);
    setNewPin('');
    flashSaved('Apparence & sécurité sauvegardées !');
  };

  const handleCustomWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setWallpaperUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await onCreateTask({
      title: newTaskTitle.trim(),
      member_id: newTaskMember,
      days_of_week: newTaskDays.length ? newTaskDays : [0, 1, 2, 3, 4, 5, 6],
      points_reward: Number(newTaskPoints) || 5,
    });
    setNewTaskTitle('');
    flashSaved('Routine quotidienne ajoutée !');
  };

  const toggleDayInList = (days: number[], dayIdx: number): number[] => {
    if (days.includes(dayIdx)) {
      const next = days.filter((d) => d !== dayIdx);
      return next.length ? next : [dayIdx];
    }
    return [...days, dayIdx].sort();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-6">
      <div className="w-full max-w-5xl h-[86vh] rounded-3xl bg-white dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-gray-900 dark:text-white">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Paramètres & Administration Familiale
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Espace Parent déverrouillé • Toutes les données sont stockées localement dans ./data/familyboard.db
            </p>
          </div>
          <div className="flex items-center gap-3">
            {savedNotice && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Check className="w-4 h-4" />
                {savedNotice}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body with Sidebar Tabs */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-64 border-r border-black/10 dark:border-white/10 p-4 space-y-2 shrink-0 bg-black/[0.02] dark:bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition ${
                activeTab === 'members'
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Users className="w-5 h-5" />
              Membres & Avatars
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition ${
                activeTab === 'tasks'
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <ListChecks className="w-5 h-5" />
              Routines Quotidiennes
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('location')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition ${
                activeTab === 'location'
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <MapPin className="w-5 h-5" />
              Météo & Prières (Ville)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition ${
                activeTab === 'appearance'
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <ImageIcon className="w-5 h-5" />
              Fond d'écran & Code PIN
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto kiosk-scroll">
            {/* TAB 1: MEMBRES & AVATARS */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                <h3 className="text-lg font-extrabold">
                  Personnalisation des 4 membres de la famille (Grille 2x2)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold uppercase opacity-70 mb-1">
                            Prénom
                          </label>
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) =>
                              onUpdateMember(m.id, { name: e.target.value })
                            }
                            className="w-full px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-bold text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase opacity-70 mb-1">
                            Rôle
                          </label>
                          <input
                            type="text"
                            value={m.role}
                            onChange={(e) =>
                              onUpdateMember(m.id, { role: e.target.value })
                            }
                            className="w-full px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-semibold text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold uppercase opacity-70 mb-1">
                            Couleur
                          </label>
                          <input
                            type="color"
                            value={m.color}
                            onChange={(e) =>
                              onUpdateMember(m.id, { color: e.target.value })
                            }
                            className="w-full h-9 rounded-xl cursor-pointer bg-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase opacity-70 mb-1">
                            Points actuels
                          </label>
                          <input
                            type="number"
                            value={m.points}
                            onChange={(e) =>
                              onUpdateMember(m.id, { points: Number(e.target.value) })
                            }
                            className="w-full px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-bold text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase opacity-70 mb-1">
                            Objectif (pts)
                          </label>
                          <input
                            type="number"
                            value={m.goal_points}
                            onChange={(e) =>
                              onUpdateMember(m.id, {
                                goal_points: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-bold text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase opacity-70 mb-1">
                          Avatar & Recadrage Photo
                        </label>
                        <AvatarCropper
                          initialAvatar={m.avatar}
                          color={m.color}
                          onChange={(dataUrl) => {
                            onUpdateMember(m.id, { avatar: dataUrl });
                            flashSaved(`Avatar de ${m.name} mis à jour !`);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: ROUTINES QUOTIDIENNES & JOURS D'APPARITION */}
            {activeTab === 'tasks' && (
              <div className="space-y-5">
                <form
                  onSubmit={handleAddNewTask}
                  className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3"
                >
                  <h4 className="font-extrabold text-sm text-amber-500">
                    Ajouter une nouvelle tâche récurrente quotidienne
                  </h4>
                  <div className="grid grid-cols-12 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Ex: Faire son lit, Lire 15 min, Sortir le chien..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="col-span-5 px-3.5 py-2 rounded-xl bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 text-sm font-semibold"
                    />
                    <select
                      value={newTaskMember ?? ''}
                      onChange={(e) =>
                        setNewTaskMember(e.target.value ? Number(e.target.value) : null)
                      }
                      className="col-span-3 px-3 py-2 rounded-xl bg-white dark:bg-[#2A2A2A] border border-black/10 dark:border-white/10 text-sm font-semibold"
                    >
                      <option value="">Toute la famille</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={newTaskPoints}
                      onChange={(e) => setNewTaskPoints(Number(e.target.value))}
                      className="col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 text-sm font-bold"
                      title="Points gagnés"
                    />
                    <button
                      type="submit"
                      className="col-span-2 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Ajouter
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold opacity-75">
                      Jours d'apparition :
                    </span>
                    {DAY_LABELS.map((d) => {
                      const active = newTaskDays.includes(d.idx);
                      return (
                        <button
                          key={d.idx}
                          type="button"
                          onClick={() =>
                            setNewTaskDays((prev) => toggleDayInList(prev, d.idx))
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition ${
                            active
                              ? 'bg-amber-500 text-white'
                              : 'bg-black/10 dark:bg-white/10 opacity-50'
                          }`}
                        >
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                </form>

                <div className="space-y-2.5">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-sm">{task.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {task.member_name || 'Famille'} • +{task.points_reward} pts
                        </div>
                      </div>

                      {/* Jours d'apparition configurables par clic */}
                      <div className="flex items-center gap-1">
                        {DAY_LABELS.map((d) => {
                          const active = task.days_of_week.includes(d.idx);
                          return (
                            <button
                              key={d.idx}
                              type="button"
                              onClick={() => {
                                const updatedDays = toggleDayInList(
                                  task.days_of_week,
                                  d.idx
                                );
                                onUpdateTask(task.id, { days_of_week: updatedDays });
                              }}
                              className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                                active
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-black/5 dark:bg-white/5 opacity-40'
                              }`}
                            >
                              {d.short}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        className="p-2 rounded-xl hover:bg-red-500/20 text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: VILLE MÉTÉO & HORAIRES DE PRIÈRE (API ALADHAN + OPEN-METEO) */}
            {activeTab === 'location' && (
              <form onSubmit={handleLocationSave} className="max-w-xl space-y-5">
                <h3 className="text-lg font-extrabold">
                  Localisation Météo (Open-Meteo) & Horaires de Prière (Aladhan)
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                      Ville
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Paris, Lyon, Marseille, Bruxelles..."
                      className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                      Pays
                    </label>
                    <input
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="France, Belgique, Maroc, Canada..."
                      className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                    Méthode de calcul des prières (API Aladhan)
                  </label>
                  <select
                    value={prayerMethod}
                    onChange={(e) => setPrayerMethod(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-[#2A2A2A] border border-black/10 dark:border-white/10 font-bold"
                  >
                    <option value={12}>
                      12 — UOIF / Musulmans de France (Recommandé en France)
                    </option>
                    <option value={3}>3 — Ligue Islamique Mondiale (MWL)</option>
                    <option value={2}>2 — ISNA (Amérique du Nord)</option>
                    <option value={4}>4 — Umm Al-Qura (La Mecque)</option>
                    <option value={5}>5 — Autorité Générale Égyptienne</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold shadow-lg shadow-amber-500/25 transition"
                >
                  Mettre à jour la météo et les prières
                </button>
              </form>
            )}

            {/* TAB 4: FOND D'ÉCRAN PERSONNALISÉ, OPACITÉ & CODE PIN PARENT */}
            {activeTab === 'appearance' && (
              <form onSubmit={handleAppearanceSave} className="max-w-2xl space-y-6">
                <div>
                  <h3 className="text-lg font-extrabold mb-2">
                    Photo de famille en fond d'écran & Opacité adaptative des cartes
                  </h3>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {WALLPAPER_PRESETS.map((preset, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setWallpaperUrl(preset.url)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                            wallpaperUrl === preset.url
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}

                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition">
                        <Upload className="w-4 h-4" />
                        Choisir une photo locale
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleCustomWallpaperUpload}
                        />
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                        Ou URL d'une image de fond
                      </label>
                      <input
                        type="text"
                        placeholder="https://... ou data:image/..."
                        value={wallpaperUrl}
                        onChange={(e) => setWallpaperUrl(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 text-xs"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>Opacité adaptative des cartes sur le fond d'écran</span>
                        <span>{Math.round(cardOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.45"
                        max="0.98"
                        step="0.02"
                        value={cardOpacity}
                        onChange={(e) => setCardOpacity(parseFloat(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-black/10 dark:border-white/10">
                  <h3 className="text-lg font-extrabold flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-amber-500" />
                    Modifier le Code PIN Parent (4 chiffres)
                  </h3>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d{4}"
                    placeholder="Laisser vide pour conserver le code PIN actuel (défaut: 1234)"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full max-w-sm px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-bold tracking-widest"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold shadow-lg shadow-amber-500/25 transition"
                >
                  Enregistrer l'apparence et le code PIN
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

