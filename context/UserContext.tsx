"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface UserContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  refresh: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = async () => {
    try {
      const response = await fetch("/api/me");
      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
      }
    } catch (error) {
      console.error("사용자 정보 조회 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, refresh: loadUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
