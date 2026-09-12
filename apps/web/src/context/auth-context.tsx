import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  fetchCurrentUser,
  loginUser,
  registerUser,
  fetchGoogleAuthUrl,
  clearAuthToken,
  getAuthToken,
  type UserSummary,
} from "../api/client.js";

interface AuthContextType {
  user: UserSummary | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  setUser: (user: UserSummary | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const storedToken = getAuthToken();
      if (storedToken) {
        try {
          const profile = await fetchCurrentUser();
          setUser(profile);
          setTokenState(storedToken);
        } catch {
          clearAuthToken();
          setUser(null);
          setTokenState(null);
        }
      }
      setIsLoading(false);
    }

    initAuth();

    // Listen for OAuth message from popups
    const messageListener = (event: MessageEvent) => {
      if (
        event.data?.type === "GOOGLE_AUTH_SUCCESS" &&
        event.data?.token &&
        event.data?.user
      ) {
        setTokenState(event.data.token);
        setUser(event.data.user);
      }
    };

    window.addEventListener("message", messageListener);
    return () => window.removeEventListener("message", messageListener);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await loginUser({ email, password });
      setUser(res.user);
      setTokenState(res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    try {
      const res = await registerUser({ email, password, name });
      setUser(res.user);
      setTokenState(res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    const authInfo = await fetchGoogleAuthUrl();
    if (!authInfo.configured) {
      alert(
        "Google OAuth is not configured on the server.\n\nTo enable Google Sign-In, please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.",
      );
      return;
    }

    const width = 550;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      authInfo.url,
      "Google Login",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`,
    );

    if (!popup) {
      alert("Please allow popups for this site.");
    }
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setTokenState(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        loginWithGoogle,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
