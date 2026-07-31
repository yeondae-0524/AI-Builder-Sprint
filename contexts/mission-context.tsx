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

export type SharedMission = {
  id: string;
  title: string;
  desc: string;
  instructions: string;
  recommendationReason: string;
  time: string;
  dist: string;
  cost: string;
  cat: string;
  requiredItems: string[];
  placeId?: string;
  placeLat?: number;
  placeLng?: number;
  placeName?: string;
};

type MissionContextType = {
  mainMission: Mission | null;
  setMainMission: (mission: Mission) => void;
  pendingSharedMission: SharedMission | null;
  shareMissionToHome: (mission: SharedMission) => void;
  clearPendingSharedMission: () => void;
};

const MissionContext = createContext<MissionContextType | undefined>(undefined);

export function MissionProvider({ children }: { children: ReactNode }) {
  const [mainMission, setMainMission] = useState<Mission | null>(null);
  const [pendingSharedMission, setPendingSharedMission] = useState<SharedMission | null>(null);

  return (
    <MissionContext.Provider
      value={{
        mainMission,
        setMainMission,
        pendingSharedMission,
        shareMissionToHome: (mission) => setPendingSharedMission(mission),
        clearPendingSharedMission: () => setPendingSharedMission(null),
      }}
    >
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