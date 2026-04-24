import AIAdvantageSection from './components/AIAdvantageSection'
import FeaturesSection from './components/FeaturesSection'
import CTASection from './components/CTASection'
import Footer from './components/Footer'
import HeroSection from './components/HeroSection'

export default function App() {
  return (
    <>
      <main>
        <HeroSection />  
        <AIAdvantageSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
