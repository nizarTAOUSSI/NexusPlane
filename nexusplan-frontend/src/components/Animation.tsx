import { BsStars } from "react-icons/bs";
import { motion, type Variants } from 'framer-motion';
import logo from '../assets/logoNexus.png';

const Animation = () => {
    const floatSlow: Variants = {
        animate: {
            y: [0, -12, 0],
            rotate: [0, 0.5, 0],
            transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const }
        }
    };

    const floatMedium: Variants = {
        animate: {
            y: [0, -10, 0],
            transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const }
        }
    };

    const floatFast: Variants = {
        animate: {
            y: [0, -8, 0],
            x: [0, 4, 0],
            transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const }
        }
    };
    return (
        <>
            <div className="w-full h-67.5 sm:h-92.5 lg:h-full overflow-hidden lg:overflow-visible mt-6 lg:mt-0">
                <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative origin-top scale-[0.45] sm:scale-[0.6] lg:scale-125 h-150 lg:h-200"
                >

                    <motion.div
                        variants={floatMedium}
                        animate="animate"
                        className="absolute top-[5%] right-[15%] w-64 h-44 bg-white/50 backdrop-blur-sm rounded-3xl border border-gray-400 shadow-lg p-5 opacity-40"
                    >
                        <div className="space-y-3">
                            <div className="h-3 bg-gray-400 rounded-full w-28" />
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-gray-400" />
                                <div className="h-3 bg-gray-400 rounded-full w-44" />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-gray-400" />
                                <div className="h-3 bg-gray-400 rounded-full w-36" />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-gray-400" />
                                <div className="h-3 bg-gray-400 rounded-full w-36" />
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        variants={floatFast}
                        animate="animate"
                        className="absolute top-[15%] right-[-5%] w-48 h-40 bg-white/40 backdrop-blur-sm rounded-3xl border border-gray-400 shadow-lg p-4 opacity-30"
                    >
                        <div className="space-y-2.5">
                            <div className="h-2.5 bg-gray-200 rounded-full w-full" />
                            <div className="h-2.5 bg-gray-200 rounded-full w-5/6" />
                            <div className="h-2.5 bg-gray-200 rounded-full w-4/6" />
                            <div className="h-2.5 bg-gray-200 rounded-full w-full" />
                            <div className="flex gap-2 mt-3">
                                <div className="w-5 h-5 rounded-full bg-gray-200" />
                                <div className="w-5 h-5 rounded-full bg-gray-200" />
                                <div className="w-5 h-5 rounded-full bg-gray-200" />
                                <div className="w-5 h-5 rounded-full bg-gray-200" />
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        variants={floatSlow}
                        animate="animate"
                        className="absolute bottom-[15%] right-[5%] w-80 h-28 bg-white/40 backdrop-blur-sm rounded-3xl border border-gray-400 shadow-lg p-4 opacity-30"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-300" />
                            <div className="h-3 bg-gray-300 rounded-full w-40" />
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-gray-300 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-gray-300">
                                <path d="M6 6L12 12L6 18M18 6L12 12L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </motion.div>

                    <motion.div
                        variants={floatSlow}
                        animate="animate"
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-145 h-105 bg-white rounded-3xl shadow-2xl shadow-gray-200/60 border border-gray-100 overflow-hidden"
                    >
                        <div className="h-14 border-b border-gray-100 flex items-center px-4 justify-between">
                            <div className="flex items-center gap-3">
                                <img src={logo} alt="Logo" className="w-8 h-8" />
                                <div className="relative flex items-center">
                                    <svg className="w-4 h-4 text-gray-400 absolute left-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <div className="w-36 h-8 bg-gray-100 rounded-full" />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex gap-1">
                                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="flex -space-x-2">
                                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-pink-400 to-purple-500 border-2 border-white" />
                                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-400 to-cyan-500 border-2 border-white" />
                                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-amber-400 to-orange-500 border-2 border-white" />
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-gray-200 ml-1" />
                                </div>
                            </div>
                        </div>

                        <div className="flex h-[calc(100%-3.5rem)]">
                            <div className="w-14 border-r border-gray-100 flex flex-col items-center py-3 gap-2 relative">
                                <motion.div whileHover={{ scale: 1.1 }} className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 cursor-pointer">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                </motion.div>
                                <motion.div whileHover={{ scale: 1.1 }} className="w-9 h-9 rounded-xl hover:bg-gray-50 flex items-center justify-center text-gray-400 cursor-pointer transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </motion.div>
                                <motion.div whileHover={{ scale: 1.1 }} className="w-9 h-9 rounded-xl hover:bg-gray-50 flex items-center justify-center text-gray-400 cursor-pointer transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </motion.div>
                                <div className="mt-auto w-7 h-7 rounded-full bg-gray-200 mb-3" />
                            </div>

                            <div className="flex-1 p-4 relative">
                                <div className="flex gap-3 mb-3">
                                    <div className="flex-1 h-2.5 bg-gray-200 rounded-full" />
                                    <div className="flex-1 h-2.5 bg-gray-200 rounded-full" />
                                    <div className="w-8" />
                                </div>

                                <div className="relative h-75">

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.8, duration: 0.4 }}
                                        whileHover={{ scale: 1.03, y: -2 }}
                                        className="absolute top-0 left-0 w-35 h-22.5 bg-white rounded-xl border-2 border-blue-500 shadow-sm p-2.5 cursor-pointer"
                                    >
                                        <div className="h-1.5 w-10 bg-blue-500 rounded-full mb-2" />
                                        <div className="space-y-1.5">
                                            <div className="h-1.5 bg-gray-200 rounded-full w-full" />
                                            <div className="h-1.5 bg-gray-200 rounded-full w-5/6" />
                                            <div className="h-1.5 bg-gray-200 rounded-full w-3/5" />
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex -space-x-1">
                                                <div className="w-4 h-4 rounded-full bg-gray-200" />
                                                <div className="w-4 h-4 rounded-full bg-gray-200" />
                                            </div>
                                            <div className="flex gap-1">
                                                <div className="w-3.5 h-3.5 rounded-full bg-purple-400" />
                                                <div className="w-3.5 h-3.5 rounded-full bg-blue-500" />
                                            </div>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.9, duration: 0.4 }}
                                        whileHover={{ scale: 1.03, y: -2 }}
                                        className="absolute top-0 left-38 w-35 h-22.5 bg-white rounded-xl border-2 border-amber-400 shadow-sm p-2.5 cursor-pointer"
                                    >
                                        <div className="h-1.5 w-10 bg-emerald-500 rounded-full mb-2" />
                                        <div className="space-y-1.5">
                                            <div className="h-1.5 bg-gray-200 rounded-full w-full" />
                                            <div className="h-1.5 bg-gray-200 rounded-full w-5/6" />
                                            <div className="h-1.5 bg-gray-200 rounded-full w-4/6" />
                                        </div>
                                        <div className="flex items-center gap-1 mt-2">
                                            <div className="w-4 h-4 rounded-full bg-red-400" />
                                            <div className="w-4 h-4 rounded-full bg-amber-400" />
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.0, duration: 0.4 }}
                                        className="absolute top-0 left-76 w-35 h-22.5 bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 opacity-70"
                                    >
                                        <div className="h-1.5 w-10 bg-gray-200 rounded-full mb-2" />
                                        <div className="space-y-1.5">
                                            <div className="h-1.5 bg-gray-200 rounded-full w-full" />
                                            <div className="h-1.5 bg-gray-200 rounded-full w-4/6" />
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.1, duration: 0.4 }}
                                        className="absolute top-22.5 left-0 w-35 h-22.5 bg-white rounded-xl border border-gray-200 shadow-sm p-2.5"
                                    >
                                        <div className="space-y-1.5">
                                            <div className="h-1.5 bg-gray-200 rounded-full w-full" />
                                            <div className="h-1.5 bg-gray-200 rounded-full w-5/6" />
                                            <div className="h-1.5 bg-gray-200 rounded-full w-3/5" />
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <div className="w-4 h-4 rounded-full bg-gray-200" />
                                            <div className="w-6 h-3 bg-gray-200 rounded-full" />
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.2, duration: 0.4 }}
                                        whileHover={{ scale: 1.03, y: -2 }}
                                        className="absolute top-25.5 left-38 w-35 h-22.5 bg-white rounded-xl border-2 border-emerald-500 shadow-sm p-2.5 cursor-pointer"
                                    >
                                        <div className="h-1.5 w-10 bg-blue-500 rounded-full mb-2" />
                                        <div className="space-y-1.5">
                                            <div className="h-1.5 bg-gray-200 rounded-full w-full" />
                                            <div className="h-1.5 bg-gray-200 rounded-full w-5/6" />
                                            <div className="h-1.5 bg-gray-200 rounded-full w-4/6" />
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex -space-x-1">
                                                <div className="w-4 h-4 rounded-full bg-gray-200" />
                                                <div className="w-6 h-3 bg-gray-200 rounded-full" />
                                            </div>
                                            <div className="flex gap-1">
                                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
                                                <div className="w-3.5 h-3.5 rounded-full bg-purple-400" />
                                            </div>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.3, duration: 0.4 }}
                                        className="absolute top-25.5 left-76 w-35 h-22.5 bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 opacity-70"
                                    >
                                        <div className="space-y-1.5">
                                            <div className="h-1.5 bg-gray-200 rounded-full w-full" />
                                            <div className="h-1.5 bg-gray-200 rounded-full w-4/6" />
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <div className="w-4 h-4 rounded-full bg-gray-200" />
                                            <div className="w-6 h-3 bg-gray-200 rounded-full" />
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        animate={{
                                            x: [0, 15, 0, -10, 0],
                                            y: [0, -10, 5, 0, 0],
                                        }}
                                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute top-[22%] left-[6%] z-20 pointer-events-none"
                                    >
                                        <svg width="38" height="38" viewBox="0 0 38 38" fill="none" className="drop-shadow-md">
                                            <path d="M8 6L30 26L17 28L13 36L8 6Z" fill="#6666ff" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" />
                                        </svg>
                                        <div className="absolute -bottom-5 left-0 bg-[#6666ff] text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-md">
                                            Othmane
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        animate={{
                                            x: [0, -12, 0, 8, 0],
                                            y: [0, 8, -5, 0, 0],
                                        }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                        className="absolute top-[56%] left-[46%] z-20 pointer-events-none"
                                    >
                                        <svg width="38" height="38" viewBox="0 0 38 38" fill="none" className="drop-shadow-md">
                                            <path d="M8 6L30 26L17 28L13 36L8 6Z" fill="#10b981" stroke="#059669" strokeWidth="2" strokeLinejoin="round" />
                                        </svg>
                                        <div className="absolute -bottom-5 left-0 bg-emerald-500 text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-md">
                                            Nizar
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
                        animate={{ opacity: 1, scale: 1, rotate: -2 }}
                        transition={{ delay: 1.4, duration: 0.5, type: "spring" }}
                        className="absolute top-[30%] right-[0%] z-30 bg-white rounded-2xl shadow-xl shadow-gray-300/40 border border-gray-100 p-4 w-47.5"
                    >
                        <div className="flex items-start gap-2.5">
                            <div>
                                <h4 className="flex gap-2 items-center text-sm font-bold text-gray-900 mb-0.5"> <BsStars size={18} className='text-blue-500' />Suggestion IA</h4>
                                <p className="text-[11px] text-gray-600 leading-snug">
                                    L'analyse montre un goulot d'étranglement sur le projet Alpha. Redonner des tâches ?
                                </p>
                            </div>
                        </div>
                        <motion.div
                            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute -top-2 -right-1 text-amber-400"
                        >
                            <svg className="w-4 h-4 fill-amber-400" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                        </motion.div>
                        <motion.div
                            animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                            className="absolute top-4 -left-2 text-amber-300"
                        >
                            <svg className="w-3 h-3 fill-amber-300" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                        </motion.div>
                    </motion.div>

                    <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute bottom-[13%] right-[16%] z-10"
                    >
                        <div className="w-10 h-10 bg-white rounded-xl shadow-md border border-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </>
    )
}

export default Animation