import { motion, type Variants } from 'framer-motion';
import { BsStars } from 'react-icons/bs';
import { FiArrowRight, FiCheck } from 'react-icons/fi';

export default function CTASection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants : Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { type: 'spring', stiffness: 120, damping: 20 } 
    },
  };

  return (
    <section className="relative py-16 sm:py-24 lg:py-32 overflow-hidden bg-[#fafafa] font-sans">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[24px_24px]" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-100 bg-linear-to-b from-blue-500/15 to-transparent blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-150 h-75 bg-linear-to-t from-cyan-400/15 to-transparent blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-6 text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col items-center"
        >
          <motion.div variants={itemVariants} className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50/80 border border-blue-100/80 backdrop-blur-sm shadow-sm">
              <BsStars className="text-blue-600 w-4 h-4" />
              <span className="text-blue-700 text-sm font-semibold tracking-wide">
                Commencer l'aventure
              </span>
            </div>
          </motion.div>

          <motion.h2
            variants={itemVariants}
            className="text-3xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-6"
          >
            Prêt à accélérer{' '}
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-blue-500 to-cyan-500">
              votre équipe ?
            </span>
          </motion.h2>

          <motion.p
            variants={itemVariants}
            className="text-slate-500 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto font-medium"
          >
            Rejoignez plus de <span className="text-slate-800 font-semibold">5 000 équipes</span> qui livrent plus vite avec NexusPlan. Gratuit 14 jours, sans carte bancaire.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          >
            <button className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold rounded-2xl px-8 py-4 overflow-hidden transition-all duration-200 active:scale-95 shadow-[0_8px_30px_rgb(5,104,250,0.25)] hover:shadow-[0_8px_30px_rgb(5,104,250,0.4)]">
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent translate-x-full group-hover:translate-x-full transition-transform duration-500" />
              <span className="relative flex items-center gap-2">
                Démarrer gratuitement
                <FiArrowRight className="group-hover:translate-x-1 transition-transform duration-200" />
              </span>
            </button>

            <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-slate-600 font-semibold bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl px-8 py-4 transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md">
              Voir une démo
            </button>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 mt-14"
          >
            {['Aucune carte requise', 'Annulation libre', 'Support inclus'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100/50">
                  <FiCheck className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                {item}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}