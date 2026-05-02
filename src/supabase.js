import { createClient } from "@supabase/supabase-js";

let client = null;

export const getSupabase = () => {
  if (!client) {
    const url = localStorage.getItem("supabase_url");
    // Fallback: if supabase_secret_key is missing, try the old supabase_key
    const secretKey = localStorage.getItem("supabase_secret_key") || localStorage.getItem("supabase_key");
    const publishableKey = localStorage.getItem("supabase_publishable_key");

    if (url && secretKey) {
      // We use the Secret Key for administrative tasks
      client = createClient(url, secretKey);
    }
  }
  return client;
};

export const initSupabase = (url, secretKey, publishableKey) => {
  localStorage.setItem("supabase_url", url);
  localStorage.setItem("supabase_secret_key", secretKey);
  if (publishableKey) {
    localStorage.setItem("supabase_publishable_key", publishableKey);
  }
  // Clear the old key if it exists
  localStorage.removeItem("supabase_key");
  
  client = createClient(url, secretKey);
  return client;
};

export const clearSupabase = () => {
  localStorage.removeItem("supabase_url");
  localStorage.removeItem("supabase_secret_key");
  localStorage.removeItem("supabase_publishable_key");
  localStorage.removeItem("supabase_key");
  client = null;
};
