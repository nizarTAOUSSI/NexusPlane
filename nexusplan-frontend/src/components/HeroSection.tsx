import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import logo from '../assets/logoNexus.png';
import Animation from './Animation';

const HeroSection = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: any) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-[#f9f9fb] overflow-hidden relative font-sans selection:bg-blue-100">
      <div className="absolute inset-0 bg-linear-to-br from-[#f9f9fb] via-white to-[#f3f4f6] pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative z-10 max-w-350 mx-auto px-8 lg:px-0 py-10 min-h-screen flex items-center">
        <motion.div
          className="z-20 absolute top-5 left-4 sm:top-8 sm:left-6 lg:top-18 lg:left-8 flex items-center gap-3"
          whileHover={{ scale: 1.02 }}
        >
          <img src={logo} alt="NexusPlan Logo" className='w-10 h-10 sm:w-14 sm:h-14 lg:w-20 lg:h-20' />
          <span className="text-xl sm:text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight">Nexus<span className="text-xl sm:text-3xl lg:text-5xl font-light text-gray-900 tracking-tight">Plan</span></span>

        </motion.div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-4 items-center w-full pt-20 sm:pt-24 lg:pt-0">

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="space-y-6 lg:space-y-8 max-w-xl lg:scale-125 mx-auto lg:mx-0"
          >
            <div className="space-y-1">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.6 }}
                className="text-[32px] sm:text-[44px] lg:text-[56px] font-bold text-gray-900 leading-[1.1] tracking-tight"
              >
                Gérez vos projets à la
              </motion.h1>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.6 }}
                className="text-[32px] sm:text-[44px] lg:text-[56px] font-bold text-gray-900 leading-[1.1] tracking-tight"
              >
                vitesse de la pensée.
              </motion.h1>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                className="text-[32px] sm:text-[44px] lg:text-[56px] font-bold text-gray-900 leading-[1.1] tracking-tight"
              >
                Ensemble.
              </motion.h1>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              className="text-lg text-gray-600 leading-relaxed max-w-md"
            >
              La première plateforme collaborative en temps réel propulsée par l'IA. Planifiez, exécutez et anticipez les risques sans jamais quitter votre espace de travail.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.6 }}
            >
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto px-8 sm:px-10 py-4 cursor-pointer bg-[#0568fa] hover:bg-[#0052d4] text-white text-lg font-medium rounded-2xl shadow-lg shadow-blue-500/20 transition-colors duration-200"
              >
                Démarrer gratuitement
              </motion.button>
            </motion.div>
          </motion.div>

          <Animation />
        </div>
      </div>

      <motion.div
        className="fixed w-96 h-96 rounded-full bg-blue-400/5 pointer-events-none z-0 blur-3xl"
        animate={{
          x: mousePosition.x - 192,
          y: mousePosition.y - 192,
        }}
        transition={{ type: "spring", damping: 30, stiffness: 200 }}
      />
    </div>
  );
};

export default HeroSection;