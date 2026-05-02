import Footer from '../components/Footer'
import CTASection from '../components/CTASection'
import FeaturesSection from '../components/FeaturesSection'
import AIAdvantageSection from '../components/AIAdvantageSection'
import HeroSection from '../components/HeroSection'

const LandingPage = () => {
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

export default LandingPage