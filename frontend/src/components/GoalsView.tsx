import React, { useState } from 'react';
import {
  Target,
  CalendarRange,
  Check,
  Plus,
  RotateCcw,
  Trash2,
  Award,
  Sparkles,
} from 'lucide-react';
import { Goal, GoalsResponse, Member } from '../types';

interface GoalsViewProps {
  goalsData: GoalsResponse;
  members: Member[];
  cardStyle: React.CSSProperties;
  onToggleGoal: (goalId: number) => Promise<void>;
  onCreateGoal: (payload: {
    title: string;
    period_type: 'weekly' | 'monthly';
    member_id: number | null;
    points_reward: number;
  }) => Promise<void>;
  onDeleteGoal: (goalId: number) => Promise<void>;
  onSimulateRollover: () => Promise<void>;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  goalsData,
  members,
  cardStyle,
  onToggleGoal,
  onCreateGoal,
  onDeleteGoal,
  onSimulateRollover,
}) => {
  const [weeklyTitle, setWeeklyTitle] = useState('');
  const [weeklyMember, setWeeklyMember] = useState<number | null>(null);
  const [monthlyTitle, setMonthlyTitle] = useState('');
  const [monthlyMember, setMonthlyMember] = useState<number | null>(null);

  const handleAddWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weeklyTitle.trim()) return;
    await onCreateGoal({
      title: weeklyTitle.trim(),
      period_type: 'weekly',
      member_id: weeklyMember,
      points_reward: 15,
    });
    setWeeklyTitle('');
  };

  const handleAddMonthly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthlyTitle.trim()) return;
    await onCreateGoal({
      title: monthlyTitle.trim(),
      period_type: 'monthly',
      member_id: monthlyMember,
      points_reward: 25,
    });
    setMonthlyTitle('');
  };

  const renderGoalCard = (goal: Goal) => (
    <div
      key={goal.id}
      onClick={() => onToggleGoal(goal.id)}
      role="button"
      tabIndex={0}
      className={`group flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.99] min-h-[72px] ${
        goal.completed
          ? 'bg-emerald-500/10 border-emerald-500/30 text-gray-400 dark:text-gray-500'
          : 'bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border-black/5 dark:border-white/10 shadow-sm'
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
            goal.completed
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 animate-check-pop'
              : 'border-2 border-gray-400/70 dark:border-white/35 hover:border-emerald-400'
          }`}
        >
          {goal.completed && <Check className="w-6 h-6 stroke-[3]" />}
        </div>

        <div className="min-w-0">
          <div
            className={`text-lg font-extrabold leading-snug ${
              goal.completed ? 'line-through opacity-75' : ''
            }`}
          >
            {goal.title}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
            {goal.member_name ? (
              <span
                className="px-3 py-0.5 rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: goal.member_color || '#3B82F6' }}
              >
                {goal.member_name}
              </span>
            ) : (
              <span className="px-3 py-0.5 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-500">
                Famille entière
              </span>
            )}

            <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-500">
              <Award className="w-4 h-4" />+{goal.points_reward} pts
            </span>

            {goal.rolled_over_count > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-sm font-bold bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30"
                title="Cet objectif non coché a été reporté automatiquement depuis la période précédente"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reporté auto ({goal.rolled_over_count}x)
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteGoal(goal.id);
        }}
        className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-red-500/20 text-gray-500 dark:text-gray-300 hover:text-red-400 transition-all duration-200 shrink-0 flex items-center justify-center"
        title="Supprimer cet objectif"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-5 h-full w-full overflow-hidden">
      {/* COLONNE 1 : Objectifs de la semaine */}
      <section
        style={cardStyle}
        className="rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-md p-5 shadow-lg h-full min-h-0 flex flex-col"
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Target className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Objectifs de la semaine
              </h2>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Semaine {goalsData.current_week} • Report automatique activé
              </p>
            </div>
          </div>

          <span className="px-3.5 py-1.5 rounded-full text-sm font-extrabold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            {goalsData.weekly.filter((g) => g.completed).length} / {goalsData.weekly.length}
          </span>
        </div>

        {/* Formulaire d'ajout rapide hebdomadaire */}
        <form onSubmit={handleAddWeekly} className="flex gap-2.5 mb-4 shrink-0">
          <input
            type="text"
            placeholder="Ajouter un objectif pour cette semaine..."
            value={weeklyTitle}
            onChange={(e) => setWeeklyTitle(e.target.value)}
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-base font-semibold"
          />
          <select
            value={weeklyMember ?? ''}
            onChange={(e) => setWeeklyMember(e.target.value ? Number(e.target.value) : null)}
            className="min-h-[48px] px-3 py-2.5 rounded-2xl bg-black/5 dark:bg-[#2A2A2A] border border-black/10 dark:border-white/10 text-sm font-bold"
          >
            <option value="">Famille</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-base flex items-center gap-1.5 transition-all duration-200 active:scale-95 shadow-md"
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        </form>

        <div className="flex-1 overflow-y-auto kiosk-scroll space-y-3 pr-1">
          {goalsData.weekly.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-dashed border-black/10 dark:border-white/10">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3">
                <Sparkles className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-extrabold">
                Aucun objectif hebdomadaire en cours ! 🎯
              </h3>
              <p className="text-base font-medium text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                Définissez un défi familial pour cette semaine ci-dessus.
              </p>
            </div>
          ) : (
            goalsData.weekly.map(renderGoalCard)
          )}
        </div>
      </section>

      {/* COLONNE 2 : Objectifs du mois */}
      <section
        style={cardStyle}
        className="rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-md p-5 shadow-lg h-full min-h-0 flex flex-col"
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <CalendarRange className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Objectifs du mois
              </h2>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Mois {goalsData.current_month} • Projets, sorties & bricolage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onSimulateRollover}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-sm font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 dark:text-amber-300 border border-amber-500/30 transition-all duration-200 active:scale-95"
              title="Simuler la fin de période pour tester le report automatique des objectifs non cochés"
            >
              <RotateCcw className="w-4 h-4" />
              Tester Report Auto
            </button>
            <span className="px-3.5 py-1.5 rounded-full text-sm font-extrabold bg-purple-500/15 text-purple-400 border border-purple-500/30">
              {goalsData.monthly.filter((g) => g.completed).length} / {goalsData.monthly.length}
            </span>
          </div>
        </div>

        {/* Formulaire d'ajout rapide mensuel */}
        <form onSubmit={handleAddMonthly} className="flex gap-2.5 mb-4 shrink-0">
          <input
            type="text"
            placeholder="Ajouter un grand objectif du mois..."
            value={monthlyTitle}
            onChange={(e) => setMonthlyTitle(e.target.value)}
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-base font-semibold"
          />
          <select
            value={monthlyMember ?? ''}
            onChange={(e) => setMonthlyMember(e.target.value ? Number(e.target.value) : null)}
            className="min-h-[48px] px-3 py-2.5 rounded-2xl bg-black/5 dark:bg-[#2A2A2A] border border-black/10 dark:border-white/10 text-sm font-bold"
          >
            <option value="">Famille</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-base flex items-center gap-1.5 transition-all duration-200 active:scale-95 shadow-md"
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        </form>

        <div className="flex-1 overflow-y-auto kiosk-scroll space-y-3 pr-1">
          {goalsData.monthly.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-dashed border-black/10 dark:border-white/10">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
                <CalendarRange className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-extrabold">
                Aucun objectif mensuel défini ! 🌟
              </h3>
              <p className="text-base font-medium text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                Planifiez une sortie culturelle, un projet bricolage ou un moment fort du mois.
              </p>
            </div>
          ) : (
            goalsData.monthly.map(renderGoalCard)
          )}
        </div>
      </section>
    </div>
  );
};
