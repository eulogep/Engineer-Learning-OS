"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  FlipHorizontal2,
  Layers,
  Play,
  Search,
  Sparkles,
  Timer,
  Turtle,
  Volume2,
} from "lucide-react";
import {
  ALL_STUDIO_VOCABULARY,
  BONUS_VOCABULARY_PACKS,
  GRAMMAR_TRAPS,
  type GrammarTrap,
  type MascotAccessoryId,
  type StudioPackId,
} from "@/modules/daily-english/studio-content";
import { VOCABULARY_PACKS } from "@/modules/daily-english/vocabulary";
import { localWordId } from "@/modules/daily-english/local-mission";
import { reviewStatus, type ReviewState } from "@/modules/daily-english/spaced-review";
import { TactileButton } from "./StudioPrimitives";
import { VoltMascot } from "./VoltMascot";
import { playTapSound, speakEnglish } from "./sound-effects";

interface PracticeHubViewProps {
  bestBlitzScore: number;
  grammarDrillsCompleted: number;
  reviews: Readonly<Record<string, ReviewState>>;
  soundEnabled: boolean;
  equippedAccessory: MascotAccessoryId | null;
  onLaunchBlitz: () => void;
  onLaunchGrammarDrill: () => void;
  onLaunchSmartReview: () => void;
}

const PACK_FILTERS: ReadonlyArray<{ id: StudioPackId | "all"; label: string }> = [
  { id: "all", label: "Tous (240)" },
  ...VOCABULARY_PACKS.map((p) => ({ id: p.id as StudioPackId, label: p.label })),
  ...BONUS_VOCABULARY_PACKS.map((p) => ({ id: p.id as StudioPackId, label: p.label })),
];

const TRAP_CATEGORIES: readonly ("Toutes" | GrammarTrap["category"])[] = [
  "Toutes",
  "Faux-ami",
  "Préposition",
  "Temps",
  "Indénombrable",
  "Syntaxe",
  "Politesse pro",
];

export function PracticeHubView({
  bestBlitzScore,
  grammarDrillsCompleted,
  reviews,
  soundEnabled,
  equippedAccessory,
  onLaunchBlitz,
  onLaunchGrammarDrill,
  onLaunchSmartReview,
}: PracticeHubViewProps) {
  const [section, setSection] = useState<"grammar" | "vault">("grammar");
  const [trapCategory, setTrapCategory] = useState<"Toutes" | GrammarTrap["category"]>("Toutes");
  const [packFilter, setPackFilter] = useState<StudioPackId | "all">("all");
  const [query, setQuery] = useState("");
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const filteredTraps = useMemo(
    () =>
      trapCategory === "Toutes"
        ? GRAMMAR_TRAPS
        : GRAMMAR_TRAPS.filter((t) => t.category === trapCategory),
    [trapCategory],
  );

  const filteredWords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_STUDIO_VOCABULARY.filter((item) => {
      if (packFilter !== "all" && item.pack !== packFilter) return false;
      if (!q) return true;
      return (
        item.word.toLowerCase().includes(q) ||
        item.translation.toLowerCase().includes(q) ||
        item.example.toLowerCase().includes(q)
      );
    });
  }, [packFilter, query]);

  const activeCard =
    filteredWords.length > 0 ? filteredWords[cardIndex % filteredWords.length] : null;

  return (
    <div className="elos-studio space-y-6">
      {/* 3 Arcade & Targeted Practice Launchers */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-3xl border-2 border-[#FED7AA] bg-gradient-to-br from-[#FFF7ED] to-white p-5 shadow-sm">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFEDD5] px-2.5 py-1 text-[11px] font-black uppercase text-[#C2410C]">
              <Timer className="h-3.5 w-3.5" /> Arcade 60s
            </span>
            <h3 className="text-lg font-black text-[#1E293B]">Match Éclair</h3>
            <p className="text-xs leading-5 text-[#64748B]">
              Traduire un maximum de termes ingénieur en 60 secondes. Record :{" "}
              <strong className="text-[#C2410C]">{bestBlitzScore}</strong>.
            </p>
          </div>
          <TactileButton
            variant="warning"
            size="sm"
            className="mt-4 w-full"
            onClick={() => {
              playTapSound(soundEnabled);
              onLaunchBlitz();
            }}
          >
            <Play className="h-4 w-4 fill-current" />
            Jouer (+XP)
          </TactileButton>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border-2 border-[#E9D5FF] bg-gradient-to-br from-[#FAF5FF] to-white p-5 shadow-sm">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#F3E8FF] px-2.5 py-1 text-[11px] font-black uppercase text-[#7E22CE]">
              <AlertTriangle className="h-3.5 w-3.5" /> 16 pièges clés
            </span>
            <h3 className="text-lg font-black text-[#1E293B]">Chasse aux Faux-Amis</h3>
            <p className="text-xs leading-5 text-[#64748B]">
              Corrige les erreurs typiques des francophones + dictée active. Sessions :{" "}
              <strong className="text-[#7E22CE]">{grammarDrillsCompleted}</strong>.
            </p>
          </div>
          <TactileButton
            variant="accent"
            size="sm"
            className="mt-4 w-full"
            onClick={() => {
              playTapSound(soundEnabled);
              onLaunchGrammarDrill();
            }}
          >
            <Sparkles className="h-4 w-4" />
            Lancer le drill (+25 XP)
          </TactileButton>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border-2 border-[#A7F3D0] bg-gradient-to-br from-[#ECFDF5] to-white p-5 shadow-sm">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#D1FAE5] px-2.5 py-1 text-[11px] font-black uppercase text-[#047857]">
              <Layers className="h-3.5 w-3.5" /> Mix 240 mots
            </span>
            <h3 className="text-lg font-black text-[#1E293B]">Révision Éclair</h3>
            <p className="text-xs leading-5 text-[#64748B]">
              Session mixte (écoute, frappe libre, banque de mots, piège francophone) sur tout le catalogue.
            </p>
          </div>
          <TactileButton
            variant="primary"
            size="sm"
            className="mt-4 w-full"
            onClick={() => {
              playTapSound(soundEnabled);
              onLaunchSmartReview();
            }}
          >
            <Play className="h-4 w-4 fill-current" />
            Réviser maintenant
          </TactileButton>
        </div>
      </div>

      {/* Sub-tabs: Grammar Lab vs 240-Word Flashcard Vault */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border-2 border-[#E2E8F0] bg-white p-1">
          <button
            type="button"
            onClick={() => setSection("grammar")}
            className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
              section === "grammar"
                ? "bg-[#6366F1] text-white"
                : "text-[#64748B] hover:text-[#1E293B]"
            }`}
          >
            Pièges Francophones (16)
          </button>
          <button
            type="button"
            onClick={() => setSection("vault")}
            className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
              section === "vault"
                ? "bg-[#6366F1] text-white"
                : "text-[#64748B] hover:text-[#1E293B]"
            }`}
          >
            Carnet & Flashcards (240)
          </button>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <VoltMascot mood="thinking" size={44} accessory={equippedAccessory} />
          <span className="text-xs font-bold text-[#64748B]">
            240 termes techniques + 16 règles prêtes à écouter
          </span>
        </div>
      </div>

      {/* SECTION A: 16 Grammar & False-Friends Cards */}
      {section === "grammar" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TRAP_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setTrapCategory(cat)}
                className={`cursor-pointer rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition-colors ${
                  trapCategory === cat
                    ? "border-[#6366F1] bg-[#EEF2FF] text-[#4338CA]"
                    : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filteredTraps.map((trap) => (
              <div
                key={trap.id}
                className="rounded-3xl border-2 border-[#E2E8F0] bg-white p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-lg bg-[#F3E8FF] px-2 py-0.5 text-[11px] font-black text-[#7E22CE]">
                      {trap.category}
                    </span>
                    <h4 className="mt-1 text-base font-black text-[#1E293B]">{trap.title}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakEnglish(trap.rightExample)}
                    className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#EEF2FF] text-[#4338CA] hover:bg-[#E0E7FF]"
                    aria-label={`Écouter ${trap.rightExample}`}
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs font-bold">
                  <p className="rounded-xl bg-[#FFF1F2] px-3 py-2 text-[#E11D48] line-through">
                    ✗ {trap.wrongExample}
                  </p>
                  <p className="rounded-xl bg-[#ECFDF5] px-3 py-2 text-[#047857]">
                    ✓ {trap.rightExample}
                  </p>
                </div>

                <p className="text-xs leading-5 text-[#475569]">{trap.explanation}</p>
                <p className="rounded-xl bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-black text-[#4338CA]">
                  💡 Mémo : {trap.mnemonic}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION B: 240-Word Vault + Interactive Flashcards */}
      {section === "vault" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#E2E8F0] bg-white p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCardIndex(0);
                  setFlipped(false);
                }}
                placeholder="Rechercher un mot, une traduction ou un exemple…"
                className="h-10 w-full rounded-xl border-2 border-[#E2E8F0] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1E293B] outline-none focus:border-[#6366F1] focus:bg-white"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                playTapSound(soundEnabled);
                setFlashcardMode((v) => !v);
                setFlipped(false);
              }}
              className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border-2 px-4 text-xs font-black uppercase tracking-wider transition-colors ${
                flashcardMode
                  ? "border-[#047857] bg-[#059669] text-white"
                  : "border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]"
              }`}
            >
              <FlipHorizontal2 className="h-4 w-4" />
              {flashcardMode ? "Vue Liste" : "Mode Flashcards"}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PACK_FILTERS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => {
                  setPackFilter(pack.id);
                  setCardIndex(0);
                  setFlipped(false);
                }}
                className={`cursor-pointer rounded-xl border-2 px-3 py-1 text-xs font-extrabold transition-colors ${
                  packFilter === pack.id
                    ? "border-[#059669] bg-[#D1FAE5] text-[#047857]"
                    : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                {pack.label}
              </button>
            ))}
          </div>

          {flashcardMode && activeCard ? (
            <div className="mx-auto max-w-xl space-y-4">
              <div
                onClick={() => {
                  playTapSound(soundEnabled);
                  setFlipped((f) => !f);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    setFlipped((f) => !f);
                  }
                }}
                className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-[#C7D2FE] bg-white p-8 text-center shadow-[0_6px_0_#E0E7FF] transition-transform active:translate-y-[2px]"
              >
                <span className="rounded-xl bg-[#EEF2FF] px-3 py-1 text-xs font-black text-[#4338CA]">
                  {activeCard.packLabel} · {activeCard.level} · {activeCard.category}
                </span>

                {!flipped ? (
                  <>
                    <p className="mt-5 text-3xl font-black text-[#1E293B]">{activeCard.word}</p>
                    <p className="mt-4 text-xs font-bold text-[#94A3B8]">
                      Clique pour révéler la traduction et l&apos;exemple
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-4 text-2xl font-black text-[#047857]">
                      {activeCard.translation}
                    </p>
                    <p className="mt-3 max-w-md text-sm italic text-[#475569]">
                      “{activeCard.example}”
                    </p>
                  </>
                )}

                <div
                  className="mt-5 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => speakEnglish(activeCard.word)}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#6366F1] px-3 text-xs font-extrabold text-white"
                  >
                    <Volume2 className="h-4 w-4" /> Écouter
                  </button>
                  <button
                    type="button"
                    onClick={() => speakEnglish(activeCard.example, { slow: true })}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-[#E2E8F0] bg-white px-3 text-xs font-extrabold text-[#475569]"
                  >
                    <Turtle className="h-4 w-4" /> Exemple lent
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <TactileButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFlipped(false);
                    setCardIndex((i) => (i - 1 + filteredWords.length) % filteredWords.length);
                  }}
                >
                  ← Précédent
                </TactileButton>
                <span className="text-xs font-black text-[#64748B]">
                  {(cardIndex % filteredWords.length) + 1} / {filteredWords.length}
                </span>
                <TactileButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setFlipped(false);
                    setCardIndex((i) => (i + 1) % filteredWords.length);
                  }}
                >
                  Suivant →
                </TactileButton>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredWords.slice(0, 60).map((item) => {
                const review = reviews[localWordId(item.word)];
                const status = review ? reviewStatus(review) : "nouveau";
                return (
                  <div
                    key={`${item.pack}-${item.word}`}
                    className="flex items-start justify-between gap-3 rounded-2xl border-2 border-[#E2E8F0] bg-white p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-base font-black text-[#1E293B]">{item.word}</span>
                        <span className="rounded-lg bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-bold text-[#64748B]">
                          {item.packLabel}
                        </span>
                        {status === "maitrise" && (
                          <span className="inline-flex items-center gap-0.5 rounded-lg bg-[#D1FAE5] px-1.5 py-0.5 text-[10px] font-black text-[#047857]">
                            <CheckCircle2 className="h-3 w-3" /> Maîtrisé
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-[#4338CA]">{item.translation}</p>
                      <p className="mt-1 text-xs italic text-[#64748B]">“{item.example}”</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakEnglish(item.word)}
                      className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#EEF2FF] text-[#4338CA] hover:bg-[#E0E7FF]"
                      aria-label={`Écouter ${item.word}`}
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              {filteredWords.length === 0 && (
                <div className="col-span-full rounded-2xl border-2 border-dashed border-[#E2E8F0] p-8 text-center">
                  <BookMarked className="mx-auto h-7 w-7 text-[#94A3B8]" />
                  <p className="mt-2 text-sm font-bold text-[#64748B]">
                    Aucun mot trouvé pour « {query} ».
                  </p>
                </div>
              )}
              {filteredWords.length > 60 && (
                <p className="col-span-full text-center text-xs font-bold text-[#94A3B8]">
                  Affichage des 60 premiers termes sur {filteredWords.length} — filtre par pack ou utilise la recherche / Mode Flashcards pour tout parcourir.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
