import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface CardMovement {
  id: string;
  card_id: string;
  gate: number;
  from_dept: string;
  from_column: string;
  to_dept: string;
  to_column: string;
  moved_by?: string;
  moved_at: string;
  notes?: string;
}

export function useCardMovements(cardId: string | undefined) {
  const [movements, setMovements] = useState<CardMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableExists, setTableExists] = useState(true);

  const load = useCallback(async () => {
    if (!cardId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("card_movements")
        .select("*")
        .eq("card_id", cardId)
        .order("moved_at", { ascending: true });

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setTableExists(false);
        } else {
          console.warn("useCardMovements:", error.message);
        }
        setMovements([]);
      } else {
        setTableExists(true);
        setMovements((data ?? []) as CardMovement[]);
      }
    } catch (e) {
      console.warn("useCardMovements exception:", e);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => { load(); }, [load]);

  return { movements, loading, tableExists, reload: load };
}
