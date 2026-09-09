import { useMemo } from "react";
import { DEPARTMENTS, type Department, type DepartmentId } from "../components/navona/data-figma";
import { useLiveDeptCounts } from "./useLiveDeptCounts";

/**
 * Retorna DEPARTMENTS com kanbanCount e vencidosCount substituídos pelos
 * valores reais do banco (1 query agregada).
 */
export function useLiveDepartments() {
  const { counts, loading } = useLiveDeptCounts();

  const departments = useMemo<Department[]>(() => {
    return DEPARTMENTS.map((d) => {
      const live = counts[d.id];
      if (!live) return d;
      return { ...d, kanbanCount: live.kanbanCount, vencidosCount: live.vencidosCount };
    });
  }, [counts]);

  const map = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d])) as Record<DepartmentId, Department>,
    [departments]
  );

  return { departments, map, loading };
}
