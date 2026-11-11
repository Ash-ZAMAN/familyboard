import React, { useState, useMemo } from 'react';
import {
  Search,
  Clock,
  Users,
  ChefHat,
  ArrowLeft,
  Check,
  Sparkles,
  Plus,
  X,
  Flame,
} from 'lucide-react';
import { Recipe } from '../types';

interface RecipesViewProps {
  recipes: Recipe[];
  cardStyle: React.CSSProperties;
  onCreateRecipe: (payload: {
    title: string;
    category: string;
    prep_time: number;
    cook_time: number;
    servings: number;
    image_url: string;
    ingredients: string[];
    steps: string[];
    tags: string[];
  }) => Promise<void>;
}

export const RecipesView: React.FC<RecipesViewProps> = ({
  recipes,
  cardStyle,
  onCreateRecipe,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Recipe Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Plat familial');
  const [newPrep, setNewPrep] = useState(15);
  const [newCook, setNewCook] = useState(25);
  const [newServings, setNewServings] = useState(4);
  const [newIngredientsText, setNewIngredientsText] = useState('');
  const [newStepsText, setNewStepsText] = useState('');

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.toLowerCase().includes(q)) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [recipes, searchQuery]);

  const openRecipeReadingMode = (rec: Recipe) => {
    setSelectedRecipe(rec);
    setCheckedIngredients({});
    setActiveStepIndex(0);
  };

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleCreateRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const ingredients = newIngredientsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const steps = newStepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    await onCreateRecipe({
      title: newTitle.trim(),
      category: newCategory,
      prep_time: Number(newPrep) || 15,
      cook_time: Number(newCook) || 20,
      servings: Number(newServings) || 4,
      image_url: '',
      ingredients: ingredients.length ? ingredients : ['Ingrédient principal'],
      steps: steps.length ? steps : ['Préparer et cuire à feu doux.'],
      tags: ['Maison', 'Famille'],
    });

    setNewTitle('');
    setNewIngredientsText('');
    setNewStepsText('');
    setShowAddModal(false);
  };

  // =========================================================================
  // MODE LECTURE "SUR LE PLAN DE TRAVAIL" (Plein Écran, Très Grosse Typographie)
  // =========================================================================
  if (selectedRecipe) {
    return (
      <div
        style={cardStyle}
        className="h-full w-full rounded-3xl border border-black/10 dark:border-white/10 backdrop-blur-md p-6 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Barre supérieure du mode Plan de Travail */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSelectedRecipe(null)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 font-extrabold text-base transition active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
              Retour aux recettes
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400">
                  {selectedRecipe.category}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  Mode Plan de travail • Écran maintenu éveillé (Wake Lock)
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight mt-1">
                {selectedRecipe.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-4 py-2 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-bold">Préparation</div>
              <div className="text-lg font-black">{selectedRecipe.prep_time} min</div>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-bold">Cuisson</div>
              <div className="text-lg font-black">{selectedRecipe.cook_time} min</div>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-bold">Portions</div>
              <div className="text-lg font-black">{selectedRecipe.servings} pers.</div>
            </div>
          </div>
        </div>

        {/* Contenu en 2 colonnes : Ingrédients cochables à gauche (4 cols) & Étapes géantes à droite (8 cols) */}
        <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
          {/* Colonne Ingrédients Cochables */}
          <div className="col-span-5 flex flex-col min-h-0 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 p-5">
            <h2 className="text-xl font-extrabold mb-3 flex items-center justify-between shrink-0">
              <span>Ingrédients à préparer</span>
              <span className="text-sm font-bold text-emerald-500">
                {Object.values(checkedIngredients).filter(Boolean).length} /{' '}
                {selectedRecipe.ingredients.length} prêts
              </span>
            </h2>

            <div className="flex-1 overflow-y-auto kiosk-scroll space-y-2.5 pr-1">
              {selectedRecipe.ingredients.map((ing, idx) => {
                const checked = !!checkedIngredients[idx];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleIngredient(idx)}
                    className={`w-full text-left flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all active:scale-[0.99] ${
                      checked
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-gray-400 dark:text-gray-500'
                        : 'bg-white/60 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.09] border-black/5 dark:border-white/10'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        checked
                          ? 'bg-emerald-500 text-white animate-check-pop'
                          : 'border-2 border-gray-400 dark:border-white/40'
                      }`}
                    >
                      {checked && <Check className="w-5 h-5 stroke-[3]" />}
                    </div>
                    <span
                      className={`text-lg font-bold leading-snug ${
                        checked ? 'line-through' : ''
                      }`}
                    >
                      {ing}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colonne Étapes Numérotées (Très grosse typographie lisible à plusieurs mètres) */}
          <div className="col-span-7 flex flex-col min-h-0 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 p-5">
            <h2 className="text-xl font-extrabold mb-3 shrink-0">
              Étapes de préparation (Touchez une étape pour la mettre en avant)
            </h2>

            <div className="flex-1 overflow-y-auto kiosk-scroll space-y-4 pr-2">
              {selectedRecipe.steps.map((stepText, idx) => {
                const isFocused = activeStepIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveStepIndex(idx)}
                    role="button"
                    tabIndex={0}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                      isFocused
                        ? 'bg-amber-500/15 border-amber-400 shadow-lg'
                        : 'bg-white/50 dark:bg-white/[0.03] border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 ${
                        isFocused
                          ? 'bg-amber-500 text-black'
                          : 'bg-black/10 dark:bg-white/10 text-gray-500 dark:text-gray-300'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <p className="text-xl md:text-2xl font-bold leading-relaxed">
                      {stepText}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VUE GRILLE DE RECETTES FAMILIALES
  // =========================================================================
  return (
    <div
      style={cardStyle}
      className="h-full w-full rounded-3xl border border-black/10 dark:border-white/10 backdrop-blur-md p-5 shadow-xl flex flex-col overflow-hidden"
    >
      {/* En-tête + Barre de recherche instantanée */}
      <div className="flex items-center justify-between gap-4 mb-5 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Livre de Recettes Familial
            </h1>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Touchez une recette pour ouvrir le mode lecture « Sur le plan de travail »
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un plat, un ingrédient (poulet, saumon, rapide)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[48px] pl-12 pr-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 font-semibold text-base focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="min-h-[48px] inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-base shadow-lg shadow-amber-500/25 transition-all duration-200 active:scale-95 shrink-0"
          >
            <Plus className="w-5 h-5" />
            Nouvelle Recette
          </button>
        </div>
      </div>

      {/* Grille des cartes de recettes ou Empty State éloquent */}
      {filteredRecipes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-dashed border-black/10 dark:border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-3">
            <ChefHat className="w-9 h-9" />
          </div>
          <h3 className="text-xl font-extrabold">
            Aucune recette ne correspond à « {searchQuery} » 🍲
          </h3>
          <p className="text-base font-medium text-gray-500 dark:text-gray-400 mt-1 max-w-md">
            Essayez un autre mot-clé ou ajoutez cette nouvelle spécialité au livre de recettes familial !
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 flex-1 min-h-0 overflow-y-auto kiosk-scroll pr-1">
          {filteredRecipes.map((rec) => (
            <div
              key={rec.id}
              onClick={() => openRecipeReadingMode(rec)}
              role="button"
              tabIndex={0}
              className="group rounded-3xl overflow-hidden bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 hover:border-amber-400/60 transition-all duration-200 flex flex-col justify-between cursor-pointer shadow-lg hover:shadow-2xl active:scale-[0.99]"
            >
              <div>
                <div className="relative h-44 w-full overflow-hidden bg-black/20">
                  <img
                    src={rec.image_url}
                    alt={rec.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 px-3.5 py-1 rounded-full text-sm font-extrabold bg-black/75 text-white backdrop-blur-md">
                    {rec.category}
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="text-xl font-extrabold leading-snug line-clamp-2 group-hover:text-amber-500 transition-colors">
                    {rec.title}
                  </h3>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {rec.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-sm font-bold bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-sm font-bold text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Prép. {rec.prep_time}m
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  Cuisson {rec.cook_time}m
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-500" />
                  {rec.servings} p.
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale d'ajout d'une nouvelle recette */}
      {showAddModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateRecipeSubmit}
            className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#1E1E1E] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold">Ajouter une recette familiale</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                  Nom du plat
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Gratin Dauphinois Traditionnel"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                  Catégorie
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                  Préparation (min)
                </label>
                <input
                  type="number"
                  value={newPrep}
                  onChange={(e) => setNewPrep(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                  Cuisson (min)
                </label>
                <input
                  type="number"
                  value={newCook}
                  onChange={(e) => setNewCook(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                  Portions
                </label>
                <input
                  type="number"
                  value={newServings}
                  onChange={(e) => setNewServings(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                  Ingrédients (1 par ligne)
                </label>
                <textarea
                  rows={5}
                  placeholder="1 kg de pommes de terre&#10;50 cl de crème entière&#10;2 gousses d'ail"
                  value={newIngredientsText}
                  onChange={(e) => setNewIngredientsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase opacity-70 mb-1">
                  Étapes (1 par ligne)
                </label>
                <textarea
                  rows={5}
                  placeholder="Éplucher et couper les pommes de terre en fines rondelles.&#10;Frotter le plat à gratin avec l'ail.&#10;Enfourner 1h à 180°C."
                  value={newStepsText}
                  onChange={(e) => setNewStepsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl font-bold bg-black/5 dark:bg-white/10"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white"
              >
                Enregistrer la recette
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

