"use client";

import { useState } from "react";
import { Award, Check, Gem, Shield, ShoppingBag, Sparkles, Trophy, Zap } from "lucide-react";
import {
  STUDIO_SHOP_ITEMS,
  computeStudioAchievements,
  type MascotAccessoryId,
  type ShopItemId,
} from "@/modules/daily-english/studio-content";
import type { GamificationState, ShopPurchaseResult } from "@/modules/daily-english/gamification";
import { TactileButton } from "./StudioPrimitives";
import { VoltMascot } from "./VoltMascot";
import { playCorrectSound, playIncorrectSound, playTapSound } from "./sound-effects";

interface TrophiesAndShopViewProps {
  gamification: GamificationState;
  missionCompletedToday: boolean;
  onPurchase: (itemId: ShopItemId) => ShopPurchaseResult;
  onEquipAccessory: (accessoryId: MascotAccessoryId | null) => void;
}

const TIER_STYLES = {
  bronze: "border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]",
  silver: "border-[#C7D2FE] bg-[#EEF2FF] text-[#4338CA]",
  gold: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
} as const;

export function TrophiesAndShopView({
  gamification,
  missionCompletedToday,
  onPurchase,
  onEquipAccessory,
}: TrophiesAndShopViewProps) {
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const soundEnabled = gamification.onboarding.soundEnabled;

  const achievements = computeStudioAchievements({
    xp: gamification.xp,
    streak: gamification.streak,
    completedNodesCount: Object.keys(gamification.completedNodes).length,
    completedStoriesCount: gamification.completedStoryIds.length,
    bestBlitzScore: gamification.bestBlitzScore,
    perfectLessonsCount: gamification.perfectLessonsCount,
    grammarDrillsCompleted: gamification.grammarDrillsCompleted,
    ownedAccessoriesCount: gamification.ownedAccessories.length,
    missionCompletedToday,
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const handleBuy = (itemId: ShopItemId) => {
    const res = onPurchase(itemId);
    if (res.ok) {
      playCorrectSound(soundEnabled);
      setNotice({ ok: true, text: res.message });
    } else {
      playIncorrectSound(soundEnabled);
      setNotice({ ok: false, text: res.reason });
    }
  };

  return (
    <div className="elos-studio space-y-8">
      {/* Mascot & Wallet Hero */}
      <div className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border-2 border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <VoltMascot mood="happy" size={96} accessory={gamification.equippedAccessory} />
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-wider text-[#6366F1]">
              Boutique locale & Succès
            </p>
            <h2 className="text-xl font-black text-[#1E293B] sm:text-2xl">
              {unlockedCount}/{achievements.length} badges débloqués
            </h2>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-extrabold">
              <span className="inline-flex items-center gap-1 rounded-xl bg-[#EEF2FF] px-3 py-1 text-[#4338CA]">
                <Gem className="h-3.5 w-3.5 fill-[#6366F1]" /> {gamification.gems} gemmes
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-[#CFFAFE] px-3 py-1 text-[#0E7490]">
                <Shield className="h-3.5 w-3.5" /> {gamification.streakFreezes} gel
                {gamification.streakFreezes > 1 ? "s" : ""} de série
              </span>
              {gamification.xpBoostActive && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-[#FFEDD5] px-3 py-1 text-[#C2410C]">
                  <Zap className="h-3.5 w-3.5 fill-[#F97316]" /> Boost XP ×2 prêt
                </span>
              )}
            </div>
          </div>
        </div>

        {gamification.equippedAccessory && (
          <button
            type="button"
            onClick={() => {
              playTapSound(soundEnabled);
              onEquipAccessory(null);
            }}
            className="cursor-pointer rounded-xl border-2 border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-extrabold text-[#64748B] hover:text-[#1E293B]"
          >
            Retirer l&apos;accessoire de Bit
          </button>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className={`rounded-2xl border-2 px-4 py-3 text-sm font-extrabold ${
            notice.ok
              ? "border-[#A7F3D0] bg-[#D1FAE5] text-[#047857]"
              : "border-[#FECDD3] bg-[#FFE4E6] text-[#E11D48]"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Shop Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-[#6366F1]" />
          <h3 className="text-lg font-black text-[#1E293B]">Boutique Gemmes</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STUDIO_SHOP_ITEMS.map((item) => {
            const isAccessory = item.kind === "accessory";
            const owned =
              isAccessory &&
              gamification.ownedAccessories.includes(item.id as MascotAccessoryId);
            const equipped = isAccessory && gamification.equippedAccessory === item.id;
            const canAfford = gamification.gems >= item.costGems;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-3xl border-2 border-[#E2E8F0] bg-white p-5 shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-[#EEF2FF] px-2.5 py-0.5 text-[11px] font-black text-[#4338CA]">
                      {item.badge}
                    </span>
                    {!owned && (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-[#4338CA]">
                        <Gem className="h-3.5 w-3.5 fill-[#6366F1]" /> {item.costGems}
                      </span>
                    )}
                  </div>

                  {isAccessory && (
                    <div className="flex justify-center py-1">
                      <VoltMascot
                        mood="idle"
                        size={72}
                        accessory={item.id as MascotAccessoryId}
                      />
                    </div>
                  )}

                  <h4 className="text-base font-black text-[#1E293B]">{item.name}</h4>
                  <p className="text-xs leading-5 text-[#64748B]">{item.description}</p>
                </div>

                <div className="mt-4">
                  {owned ? (
                    <TactileButton
                      variant={equipped ? "outline" : "primary"}
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        playTapSound(soundEnabled);
                        onEquipAccessory(equipped ? null : (item.id as MascotAccessoryId));
                      }}
                    >
                      <Check className="h-4 w-4" />
                      {equipped ? "Équipé (Retirer)" : "Équiper sur Bit"}
                    </TactileButton>
                  ) : (
                    <TactileButton
                      variant="info"
                      size="sm"
                      disabled={!canAfford}
                      className="w-full"
                      onClick={() => handleBuy(item.id)}
                    >
                      <Sparkles className="h-4 w-4" />
                      {canAfford ? `Débloquer (${item.costGems})` : `${item.costGems} gemmes requis`}
                    </TactileButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Achievements Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#FBBF24]" />
          <h3 className="text-lg font-black text-[#1E293B]">Succès & Trophées</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {achievements.map((ach) => {
            const pct = Math.round((ach.current / Math.max(1, ach.target)) * 100);
            return (
              <div
                key={ach.id}
                className={`rounded-2xl border-2 p-4 transition-colors ${
                  ach.unlocked ? TIER_STYLES[ach.tier] : "border-[#E2E8F0] bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                        ach.unlocked ? "bg-white shadow-xs" : "bg-[#F8FAFC] text-[#94A3B8]"
                      }`}
                    >
                      <Award className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-black text-[#1E293B]">{ach.title}</p>
                      <p className="text-xs font-medium text-[#64748B]">{ach.description}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-black text-[#334155]">
                    {ach.current}/{ach.target}
                  </span>
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-black/10">
                  <div
                    className={`h-full rounded-full ${
                      ach.unlocked ? "bg-[#059669]" : "bg-[#6366F1]"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
