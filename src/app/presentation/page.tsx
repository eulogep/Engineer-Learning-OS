import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Présentation",
  description: "Engineer Learning OS en 1 min 40 : apprendre l’ingénierie avec des preuves, pas des pourcentages.",
};

export default function PresentationPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Présentation</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Engineer Learning OS en 1 min 40</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Apprendre l’ingénierie avec des preuves, pas des pourcentages : missions concrètes, Daily English avec reconnaissance vocale sur l’appareil, répétition espacée et progression vérifiable.
        </p>
      </header>

      <video
        className="aspect-video w-full rounded-2xl border bg-black shadow-sm"
        controls
        playsInline
        preload="metadata"
        poster="/media/presentation-poster.jpg"
      >
        <source src="/media/engineer-learning-os-presentation.mp4" type="video/mp4" />
        <track kind="captions" src="/media/engineer-learning-os-presentation.fr.vtt" srcLang="fr" label="Français" />
        Votre navigateur ne lit pas la vidéo : <a href="/media/engineer-learning-os-presentation.mp4">téléchargez-la</a>.
      </video>

      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900">Essayer maintenant</Link>
        <Link href="/daily-english" className="rounded-xl border px-5 py-3 font-semibold hover:bg-slate-50">Daily English Mission</Link>
        <a href="https://github.com/eulogep/Engineer-Learning-OS" className="rounded-xl border px-5 py-3 font-semibold hover:bg-slate-50">Code source</a>
      </div>
    </div>
  );
}
