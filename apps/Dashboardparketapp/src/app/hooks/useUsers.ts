import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_color: string;
}

export function useUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("user_profiles")
      .select("id, email, full_name, role, avatar_color")
      .then(({ data }) => {
        setUsers((data ?? []) as AppUser[]);
        setLoading(false);
      });
  }, []);

  return { users, loading };
}
