import { motion } from 'framer-motion';
import { BsStars } from 'react-icons/bs';

const COLS = [
  { label: 'À faire',  bg: '#f1f5f9', ring: 'ring-slate-200', tasks: ['Onboarding UX', 'API endpoints'] },
  { label: 'En cours', bg: '#eff6ff', ring: 'ring-blue-100',  tasks: ['Dashboard analytics'] },
  { label: 'Terminé',  bg: '#f0fdf4', ring: 'ring-emerald-100', tasks: ['Auth module', 'CI pipeline'] },
];

const GANTT = [
  { name: 'Phase 1', w: '55%', ml: '0%',  bg: '#bfdbfe', text: '#2563eb' },
  { name: 'Phase 2', w: '40%', ml: '20%', bg: '#ddd6fe', text: '#7c3aed' },
  { name: 'Phase 3', w: '35%', ml: '45%', bg: '#bbf7d0', text: '#059669' },
];


const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 20 } },
};

export default function FeaturesSection() {
  return (
    <section className="relative py-16 sm:py-20 lg:py-28 overflow-hidden bg-white font-sans">
      <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/3 w-125 h-125 bg-linear-to-l from-cyan-400/10 to-transparent blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-100 h-100 bg-linear-to-br from-blue-400/8 to-transparent blur-[80px] rounded-full pointer-events-none" />

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
              <span className="text-blue-700 text-sm font-semibold tracking-wide">Fonctionnalités</span>
            </div>
          </motion.div>

          <motion.h2
            variants={item}
            className="text-3xl sm:text-4xl lg:text-[3.4rem] font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-8 lg:mb-14 max-w-2xl"
          >
            Tout ce dont votre équipe{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-blue-500 to-cyan-500">
              a besoin.
            </span>
          </motion.h2>

          <div className="grid md:grid-cols-4 gap-4">

            <motion.div
              variants={item}
              whileHover={{ y: -6, scale: 1.01 }}
              className="group md:col-span-2 md:row-span-2 bg-white rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-xl transition-shadow duration-300 p-6 lg:p-8 flex flex-col overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-linear-to-br from-blue-500/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-4">
                  Kanban
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1.5">Visualisez le flux en temps réel</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">Glissez-déposez les tâches, assignez vos membres et suivez l'avancement instantanément.</p>
                <div className="space-y-3">
                  {COLS.map((c) => (
                    <div key={c.label} className="flex items-start gap-3">
                      <span className="text-[10px] font-bold text-slate-400 w-14 shrink-0 pt-2 uppercase tracking-wide">{c.label}</span>
                      <div className="flex flex-col gap-1.5 flex-1">
                        {c.tasks.map((t) => (
                          <div
                            key={t}
                            className={`rounded-lg px-3 py-2 text-xs font-medium text-slate-700 ring-1 ${c.ring}`}
                            style={{ background: c.bg }}
                          >
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={item}
              whileHover={{ y: -6, scale: 1.01 }}
              className="group md:col-span-2 bg-white rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-xl transition-shadow duration-300 p-6 lg:p-8 overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-linear-to-br from-violet-500/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wider mb-4">
                  Gantt
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Timeline & jalons</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-5">Planifiez les dépendances sur une timeline claire et intuitive.</p>
                <div className="space-y-2.5">
                  {GANTT.map((b) => (
                    <div key={b.name} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-14 shrink-0 font-medium">{b.name}</span>
                      <div className="flex-1 h-5 rounded-full bg-slate-100 relative overflow-hidden">
                        <div
                          className="absolute top-0 h-full rounded-full text-[9px] font-bold flex items-center px-2"
                          style={{ width: b.w, left: b.ml, background: b.bg, color: b.text }}
                        >
                          {b.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={item}
              whileHover={{ y: -6, scale: 1.01 }}
              className="group md:col-span-2 bg-white rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-xl transition-shadow duration-300 p-6 lg:p-8 overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-linear-to-br from-emerald-500/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider mb-4">
                  Rapports
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Insights IA automatiques</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-5">Métriques temps réel, sans configuration.</p>
                <div className="flex items-end gap-1.5 h-12">
                  {[55, 75, 45, 90, 65, 100, 50,80 ,44,5,99,77].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm transition-all duration-300"
                      style={{ height: h + '%', background: i === 5 ? '#2563eb' : '#dbeafe' }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}
