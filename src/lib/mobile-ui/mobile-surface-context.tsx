'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type MobileSurfaceContextValue = {
  isMobileSurface: boolean;
  setMobileSurface: (value: boolean) => void;
};

const MobileSurfaceContext = createContext<MobileSurfaceContextValue>({
  isMobileSurface: false,
  setMobileSurface: () => {},
});

export function MobileSurfaceProvider({ children }: { children: React.ReactNode }) {
  const [isMobileSurface, setIsMobileSurfaceState] = useState(false);
  const setMobileSurface = useCallback((value: boolean) => {
    setIsMobileSurfaceState(value);
  }, []);
  const value = useMemo(
    () => ({ isMobileSurface, setMobileSurface }),
    [isMobileSurface, setMobileSurface],
  );
  return <MobileSurfaceContext.Provider value={value}>{children}</MobileSurfaceContext.Provider>;
}

export function useMobileSurface() {
  return useContext(MobileSurfaceContext);
}
