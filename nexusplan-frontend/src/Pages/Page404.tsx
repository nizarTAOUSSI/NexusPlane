import { Link } from "react-router-dom"
import error from "../assets/404Animation.json"
import Lottie from "lottie-react"

const Page404 = () => {
    return (
        <>
            <div className=' flex flex-col items-center justify-center h-screen'>
                <Lottie animationData={error} loop={true}/>
                <h1 className='text-3xl font-bold mt-2' ><span className='text-red-600'>Oups!</span>Page introuvable</h1>
                <p>La page que vous recherchez n'existe pas.</p>
                <button className='primary-btn mt-3'>
                    <Link to="/" >Retour à l'accueil</Link>
                </button>
            </div>
        </>
    )
}

export default Page404