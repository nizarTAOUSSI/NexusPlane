import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BsStars } from 'react-icons/bs';

function useCountUp(target: number, duration = 1400) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setCount(Math.round(ease * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return { ref, count };
}

function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, count } = useCountUp(value);
  return (
    <div ref={ref} className="flex flex-col gap-1 text-center">
      <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">{count}{suffix}</span>
      <span className="text-slate-500 text-sm font-medium">{label}</span>
    </div>
  );
}

const CARDS = [
  {
    num: '01',
    title: 'Analyse Prédictive',
    subtitle: 'de Risques',
    desc: "Identifie les risques avant qu'ils ne deviennent des problèmes — retards, conflits de ressources, dépendances critiques.",
    from: 'from-blue-500/10',
    iconColor: 'text-blue-600',
    badge: 'bg-blue-50 text-blue-700 border-blue-100',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Allocation Intelligente',
    subtitle: 'des Ressources',
    desc: "Optimise les affectations d'équipe en temps réel selon la disponibilité, les compétences et la charge de travail.",
    from: 'from-emerald-500/10',
    iconColor: 'text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Collaboration',
    subtitle: "Boostée par l'IA",
    desc: "Des suggestions contextuelles et des insights automatiques pour accélérer la prise de décision collective.",
    from: 'from-violet-500/10',
    iconColor: 'text-violet-600',
    badge: 'bg-violet-50 text-violet-700 border-violet-100',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
];

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 20 } },
};

export default function AIAdvantageSection() {
  return (
    <section className="relative py-16 sm:py-20 lg:py-28 overflow-hidden bg-[#fafafa] font-sans">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[24px_24px]" />
      <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/4 w-150 h-125 bg-linear-to-bl from-violet-400/10 to-transparent blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/4 w-125 h-100 bg-linear-to-tr from-blue-400/10 to-transparent blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 lg:px-6">
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="flex flex-col"
        >
          <motion.div variants={item} className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50/80 border border-blue-100/80 backdrop-blur-sm shadow-sm">
              <BsStars className="text-blue-600 w-4 h-4" />
              <span className="text-blue-700 text-sm font-semibold tracking-wide">Intelligence Artificielle</span>
            </div>
          </motion.div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16">
            <motion.h2
              variants={item}
              className="text-3xl sm:text-4xl lg:text-[3.4rem] font-extrabold text-slate-900 leading-[1.1] tracking-tight max-w-2xl"
            >
              L'IA qui anticipe,{' '}
              <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-blue-500 to-cyan-500">
                pas qui réagit.
              </span>
            </motion.h2>
            <motion.p
              variants={item}
              className="text-slate-500 text-base max-w-sm leading-relaxed font-medium"
            >
              NexusPlan ne suit pas vos projets — il les anticipe et les optimise à chaque instant.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-16">
            {CARDS.map((card) => (
              <motion.div
                key={card.num}
                variants={item}
                whileHover={{ y: -6, scale: 1.01 }}
                className="group bg-white rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-xl transition-shadow duration-300 p-6 lg:p-8 flex flex-col gap-5 cursor-default overflow-hidden relative"
              >
                <div className={`absolute inset-0 bg-linear-to-br ${card.from} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                
                <div className="relative flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${card.badge} uppercase tracking-wider`}>
                    {card.num}
                  </span>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 ${card.iconColor}`}>
                    {card.icon}
                  </div>
                </div>
                <div className="relative">
                  <h3 className="text-lg font-bold text-slate-900 mb-0.5">{card.title}</h3>
                  <p className={`text-sm font-semibold mb-3 ${card.iconColor}`}>{card.subtitle}</p>
                  <p className="text-slate-500 text-sm leading-relaxed">{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            variants={item}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 py-10 border-t border-slate-100"
          >
            <StatCounter value={5000} suffix="+" label="Équipes actives" />
            <StatCounter value={98} suffix="%" label="Satisfaction client" />
            <StatCounter value={40} suffix="%" label="Réunions en moins" />
            <StatCounter value={3} suffix="x" label="Plus rapide" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
