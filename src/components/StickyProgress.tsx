import { useEffect, useState } from "react";

export default function StickyProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const next = scrollHeight <= 0 ? 0 : (scrollTop / scrollHeight) * 100;
      setProgress(Math.min(Math.max(next, 0), 100));
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 bg-white/5">
        <div
          className="h-full rounded-r-full bg-[linear-gradient(90deg,#fb923c_0%,#38bdf8_52%,#34d399_100%)] transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="pointer-events-none fixed right-4 top-24 z-[65] hidden rounded-full border border-white/10 bg-slate-950/75 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-2xl backdrop-blur-xl lg:block">
        {Math.round(progress)}% read
      </div>
    </>
  );
}
