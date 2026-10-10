// Écran de lancement : la jauge se remplit, puis l'écran s'efface (CSS seul, ~1,5 s).
// Une fois par onglet : le script masque l'écran avant le premier rendu s'il a déjà été vu.
const ONCE = `try{sessionStorage.getItem("jauge-splash")?document.documentElement.classList.add("no-splash"):sessionStorage.setItem("jauge-splash","1")}catch(e){}`;

export function Splash({ name }: { name: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ONCE }} />
      <div className="splash" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="88" height="88">
          <rect width="32" height="32" rx="8" fill="#0f5c4d" />
          <path className="splash-arc" pathLength={1} d="M7 21a9 9 0 0 1 18 0" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <path className="splash-needle" d="M16 21l5-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="16" cy="21" r="2" fill="#fff" />
        </svg>
        <span className="splash-word">{name}</span>
      </div>
    </>
  );
}
