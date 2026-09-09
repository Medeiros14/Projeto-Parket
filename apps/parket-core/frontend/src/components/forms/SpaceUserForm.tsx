import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Field, Input, Select, Button, FormGrid } from "../ui/Form";
import { api, type SpaceUser } from "../../lib/api";
import { toast } from "../../lib/toast";

const ROLES = ["superadmin", "admin", "dept_leader", "viewer", "projetista"] as const;

const DEPARTAMENTOS = [
  "comercial", "comercial-entrada", "atendimento",
  "orcamento", "projetos", "producao",
  "compras", "logistica",
  "operacional", "fiscal",
  "financeiro", "rh", "ia",
];

const PERM_VALUES = ["", "view", "manage"] as const;
const PERM_LABEL: Record<string, string> = { "": "—", "view": "Visualizar", "manage": "Gerenciar" };

export function SpaceUserForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial: SpaceUser | null;
}) {
  const [form, setForm] = useState<Partial<SpaceUser>>({});
  const [perms, setPerms] = useState<Record<string, string>>({});
  const [inactive, setInactive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !initial) return;
    setForm(initial);
    const dp = (initial.dept_permissions || {}) as Record<string, any>;
    const next: Record<string, string> = {};
    for (const d of DEPARTAMENTOS) next[d] = String(dp[d] || "");
    setPerms(next);
    setInactive(Boolean(dp._inactive));
  }, [open, initial]);

  const set = (k: keyof SpaceUser, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!initial?.id) return;
    setSaving(true);
    try {
      const dp: Record<string, any> = {};
      for (const d of DEPARTAMENTOS) {
        if (perms[d]) dp[d] = perms[d];
      }
      if (inactive) {
        dp._inactive = true;
        dp.desativado_em = new Date().toISOString().slice(0, 10);
      }
      // Preserva flags antigas que não estão no UI
      const oldDp = (initial.dept_permissions || {}) as Record<string, any>;
      for (const k of Object.keys(oldDp)) {
        if (k.startsWith("_") && k !== "_inactive" && !(k in dp)) dp[k] = oldDp[k];
      }
      const payload: any = {
        full_name: form.full_name?.trim() || null,
        role: inactive ? "viewer" : form.role,
        dept_permissions: dp,
        avatar_color: form.avatar_color || null,
      };
      await api.updateSpaceUser(initial.id, payload);
      toast.success("Usuário atualizado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  if (!initial) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar — ${initial.full_name || initial.email}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={saving}>
            <Save size={12} /> Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Field label="Email">
            <Input value={form.email || ""} disabled />
          </Field>
          <Field label="Nome completo">
            <Input value={form.full_name || ""} onChange={(e) => set("full_name", e.target.value)} />
          </Field>
        </FormGrid>

        <FormGrid cols={3}>
          <Field label="Role" hint="superadmin = acesso total">
            <Select value={form.role || "viewer"} onChange={(e) => set("role", e.target.value)} disabled={inactive}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Cor do avatar">
            <Input type="color" value={form.avatar_color || "#B8AA9A"} onChange={(e) => set("avatar_color", e.target.value)} />
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />
              <span className="text-xs">Desativar acesso (sai da equipe)</span>
            </label>
          </Field>
        </FormGrid>

        <div className="border-t border-parket-border pt-4">
          <h3 className="text-[11px] uppercase tracking-wider text-parket-textDim font-semibold mb-3">
            Permissões por departamento
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {DEPARTAMENTOS.map((d) => (
              <div key={d} className="flex items-center gap-2 bg-parket-panelLight border border-parket-border rounded px-2 py-1.5">
                <span className="text-xs flex-1">{d}</span>
                <select
                  value={perms[d] || ""}
                  onChange={(e) => setPerms((p) => ({ ...p, [d]: e.target.value }))}
                  disabled={inactive}
                  className="text-[10px] px-1.5 py-0.5 bg-parket-bg border border-parket-border rounded"
                >
                  {PERM_VALUES.map((v) => <option key={v} value={v}>{PERM_LABEL[v]}</option>)}
                </select>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-parket-textDim mt-2">
            "Visualizar" = pode ver; "Gerenciar" = pode editar/criar/excluir.
            Vazio = sem acesso a esse setor.
          </p>
        </div>
      </div>
    </Modal>
  );
}
