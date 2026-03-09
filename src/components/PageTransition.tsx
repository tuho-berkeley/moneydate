import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    setTransitioning(true);
    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      setTransitioning(false);
    }, 80);
    return () => clearTimeout(timeout);
  }, [location.pathname]);

  // On first render, just show children
  useEffect(() => {
    setDisplayChildren(children);
  }, [children]);

  return (
    <div
      className="transition-all duration-200 ease-out"
      style={{
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? "translateY(6px)" : "translateY(0)",
      }}
    >
      {displayChildren}
    </div>
  );
};

export default PageTransition;
