import { useNavigate } from "react-router-dom";

const BackBtn = (
    { link }: { link: string }
) => {
    const navigate = useNavigate();
    return (
        <button
            className="bg-white text-center cursor-pointer w-48 rounded-2xl h-14 relative text-black text-xl font-semibold group"
            type="button"
            onClick={()=> navigate(link)}
        >
            <div
                className="bg-[#0d6efd] hover:bg-700 rounded-xl h-12 w-1/4 flex items-center justify-center absolute left-1 top-1 group-hover:w-46 z-10 duration-500"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1024 1024"
                    height="25px"
                    width="25px"
                >
                    <path
                        d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z"
                        fill="#ffffff"
                    ></path>
                    <path
                        d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
                        fill="#ffffff"
                    ></path>
                </svg>
            </div>
            <p className="translate-x-2">Go Back</p>
        </button>

    )
}

export default BackBtn