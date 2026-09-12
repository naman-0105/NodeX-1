import React, { useEffect, useState, useRef } from "react";
import { handleGoogleCallback } from "../../api/client.js";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/auth-context.js";

export const GoogleCallback: React.FC<{ onComplete: () => void }> = ({
  onComplete,
}) => {
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    async function processCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        setError("No authorization code found in URL");
        return;
      }

      try {
        const res = await handleGoogleCallback(code);

        setUser(res.user);

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );

        onComplete();
      } catch (err: any) {
        setError(err.message || "Google authentication failed");
      }
    }

    processCallback();
  }, [onComplete, setUser]);

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          width: "100vw",
          backgroundColor: "#f8fafc",
        }}
      >
        <div
          style={{
            padding: "24px",
            backgroundColor: "#ffffff",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            maxWidth: "400px",
            textAlign: "center",
          }}
        >
          <AlertCircle
            size={28}
            color="#dc2626"
            style={{ margin: "0 auto 12px" }}
          />
          <h3
            style={{ fontSize: "15px", color: "#991b1b", marginBottom: "8px" }}
          >
            Authentication Error
          </h3>
          <p
            style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}
          >
            {error}
          </p>
          <button
            onClick={() => {
              window.history.replaceState({}, document.title, "/");
              onComplete();
            }}
            style={{
              padding: "6px 14px",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        backgroundColor: "#f8fafc",
        gap: "12px",
      }}
    >
      <Loader2 size={24} className="animate-spin" color="#0f172a" />
      <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
        Authenticating with Google...
      </span>
    </div>
  );
};
