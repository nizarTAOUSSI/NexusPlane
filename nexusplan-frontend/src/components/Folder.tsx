import { useNavigate } from "react-router-dom";

interface FolderProps {
  title: string;
  link: string;
  subtitle?: string;
  memberCount?: number;
  status?: string;
}


const Folder: React.FC<FolderProps> = ({
  title,
  link,
  subtitle,
  memberCount,
  status,
}) => {
  const navigate = useNavigate();


  return (
    <button onClick={() => navigate(link)} title={title}
      className="relative group flex flex-col items-center justify-center w-full h-full"
    >
      <div
        className="file relative w-60 h-40 cursor-pointer origin-bottom perspective-[1500px] z-50"
      >
        <div
          className="work-5 bg-amber-600 w-full h-full origin-top rounded-2xl rounded-tl-none group-hover:shadow-[0_20px_40px_rgba(0,0,0,.2)] transition-all ease duration-300 relative after:absolute after:content-[''] after:bottom-[99%] after:left-0 after:w-20 after:h-4 after:bg-amber-600 after:rounded-t-2xl before:absolute before:content-[''] before:-top-3.75 before:left-[75.5px]"
        ></div>
        <div
          className="work-4 absolute inset-1 bg-zinc-400 rounded-2xl transition-all ease duration-300 origin-bottom select-none group-hover:transform-[rotateX(-20deg)]"
        ></div>
        <div
          className="work-3 absolute inset-1 bg-zinc-300 rounded-2xl transition-all ease duration-300 origin-bottom group-hover:transform-[rotateX(-30deg)]"
        ></div>
        <div
          className="work-2 absolute inset-1 bg-zinc-200 rounded-2xl transition-all ease duration-300 origin-bottom group-hover:transform-[rotateX(-38deg)]"
        ></div>
        <div
          className="work-1 absolute bottom-0 bg-linear-to-t from-amber-500 to-amber-400 w-full h-39 rounded-2xl rounded-tr-none after:absolute after:content-[''] after:bottom-[99%] after:right-0 after:w-36.5 after:h-4 after:bg-amber-400 after:rounded-t-2xl before:absolute before:content-[''] before:-top-2.5 before:right-35.5 before:size-3 transition-all ease duration-300 origin-bottom flex items-end group-hover:shadow-[inset_0_20px_40px_#fbbf24,inset_0_-20px_40px_#d97706] group-hover:transform-[rotateX(-46deg)_translateY(1px)]"
        ></div>
      </div>
      <div className="mt-4 text-center px-2 w-full">
        <p className="text-sm font-semibold text-(--text-1) truncate leading-tight">{title}</p>
        {subtitle && (
          <p className="text-xs text-(--text-3) mt-0.5 truncate">{subtitle}</p>
        )}
        <div className="flex items-center justify-center gap-2 mt-1.5">
          {status && (
            <span className={`
              text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full
              ${status === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'}
            `}>
              {status}
            </span>
          )}
          {memberCount !== undefined && (
            <span className="text-[10px] text-(--text-3)">
              👥 {memberCount} member{memberCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default Folder;