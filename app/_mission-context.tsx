import { createContext, ReactNode, useContext, useState } from "react";

export type Mission = {
  id: number | string;
  title: string;
  desc: string;
  time: string;
  dist: string;
  cost: string;
  cat: string;
  star?: boolean;
  placeLat?: number;
  placeLng?: number;
  placeName?: string;
  badgeIds?: string[];
  recommendationReason?: string;
  requiredItems?: string[];
};

export type ActiveAttempt = {
  attemptId: string;
  journeyId: string;
  missionId: string | number;
  title: string;
  placeName?: string;
};

type MissionContextType = {
  activeAttempts: ActiveAttempt[];
  addActiveAttempt: (attempt: ActiveAttempt) => void;
  removeActiveAttempt: (attemptId: string) => void;
};

const MissionContext = createContext<MissionContextType | undefined>(undefined);

export function MissionProvider({ children }: { children: ReactNode }) {
  const [activeAttempts, setActiveAttempts] = useState<ActiveAttempt[]>([]);

  const addActiveAttempt = (attempt: ActiveAttempt) => {
    setActiveAttempts((prev) => {
      if (prev.some((a) => a.attemptId === attempt.attemptId)) return prev;
      return [...prev, attempt];
    });
  };

  const removeActiveAttempt = (attemptId: string) => {
    setActiveAttempts((prev) => prev.filter((a) => a.attemptId !== attemptId));
  };

  return (
    <MissionContext.Provider value={{ activeAttempts, addActiveAttempt, removeActiveAttempt }}>
      {children}
    </MissionContext.Provider>
  );
}

export function useMission() {
  const context = useContext(MissionContext);
  if (!context) throw new Error("useMission은 MissionProvider 안에서만 사용할 수 있어요");
  return context;
}