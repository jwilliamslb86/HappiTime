import { useEffect } from "react";
import * as Linking from "expo-linking";
import { supabase } from "../api/supabaseClient";

function extractTokens(url: string) {
  // magic links come as: happitime://auth/callback#access_token=...&refresh_token=...&...
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;

  const fragment = url.slice(hashIndex + 1);
  const params = fragment.split("&").reduce((acc, part) => {
    const [rawKey, rawValue = ""] = part.split("=");
    acc[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
    return acc;
  }, {} as Record<string, string>);

  const access_token = params["access_token"];
  const refresh_token = params["refresh_token"];

  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export function useMagicLinkListener() {
  useEffect(() => {
    const handleUrl = async (url: string) => {
      console.log("🔥 Deep link received:", url);

      const tokens = extractTokens(url);
      if (!tokens) {
        console.log("❌ No tokens found in deep link.");
        return;
      }

      const { access_token, refresh_token } = tokens;

      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      console.log("✅ setSession result:", {
        hasSession: !!data?.session,
        error: error?.message,
      });
    };

    // Cold start
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Foreground
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);
}
