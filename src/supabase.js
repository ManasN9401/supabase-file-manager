import { createClient } from "@supabase/supabase-js";

let client = null;

export const getSupabase = () => {
  if (!client) {
    const url = localStorage.getItem("supabase_url");
    const key = localStorage.getItem("supabase_key");
    if (url && key) {
      client = createClient(url, key);
    }
  }
  return client;
};

export const initSupabase = (url, key) => {
  localStorage.setItem("supabase_url", url);
  localStorage.setItem("supabase_key", key);
  client = createClient(url, key);
  return client;
};

export const clearSupabase = () => {
  localStorage.removeItem("supabase_url");
  localStorage.removeItem("supabase_key");
  client = null;
};
