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
};

type MissionContextType = {
  mainMission: Mission | null;
  setMainMission: (mission: Mission) => void;
};

const MissionContext = createContext<MissionContextType | undefined>(undefined);

export function MissionProvider({ children }: { children: ReactNode }) {
  const [mainMission, setMainMission] = useState<Mission | null>(null);

  return (
    <MissionContext.Provider value={{ mainMission, setMainMission }}>
      {children}
    </MissionContext.Provider>
  );
}

export function useMission() {
  const context = useContext(MissionContext);
  if (!context) {
    throw new Error("useMission은 MissionProvider 안에서만 사용할 수 있어요");
  }
  return context;
}