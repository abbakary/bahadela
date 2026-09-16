import { useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);

export default function UserForm({ initial, onSubmit, onCancel, showPin = false }) {
  const [form, setForm] = useState(() => ({
    employee_no: initial?.employee_no || "",
    first_name: initial?.first_name || "",
    middle_name: initial?.middle_name || "",
    last_name: initial?.last_name || "",
    name: initial?.name || "",
    gender: initial?.gender || "unspecified",
    valid_from: initial?.valid_from || today(),
    valid_until: initial?.valid_until || "2036-12-31",
    access_plan: initial?.access_plan || 1,
    pin: "",
    confirm: false,
  }));
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const name =
        form.name ||
        [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" ").trim();
      await onSubmit({
        employee_no: String(form.employee_no).trim(),
        name,
        gender: form.gender,
        valid_from: form.valid_from,
        valid_until: form.valid_until,
        access_plan: Number(form.access_plan) || 1,
        pin: form.pin,
        confirm: form.confirm,
      });
    } finally {
      setSaving(false);
    }
  };

  const editing = Boolean(initial?.employee_no);

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field">
        Employee ID *
        <input
          required
          maxLength={32}
          value={form.employee_no}
          disabled={editing}
          onChange={(e) => set("employee_no", e.target.value)}
          placeholder="Example: 1001"
        />
      </label>

      {editing ? (
        <label className="field">
          Full name *
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </label>
      ) : (
        <>
          <div className="form-row two">
            <label className="field">
              First name *
              <input required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </label>
            <label className="field">
              Middle name
              <input value={form.middle_name} onChange={(e) => set("middle_name", e.target.value)} />
            </label>
          </div>
          <label className="field">
            Last name *
            <input required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </label>
        </>
      )}

      <label className="field">
        Gender
        <select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
          <option value="unspecified">Unspecified</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>

      <div className="form-row two">
        <label className="field">
          Effective from
          <input type="date" value={form.valid_from} onChange={(e) => set("valid_from", e.target.value)} />
        </label>
        <label className="field">
          Effective until
          <input type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} />
        </label>
      </div>

      <label className="field">
        Access plan template
        <input
          type="number"
          min={1}
          max={255}
          value={form.access_plan}
          onChange={(e) => set("access_plan", e.target.value)}
        />
      </label>

      {showPin ? (
        <>
          <label className="field">
            Enrollment PIN *
            <input
              type="password"
              required
              value={form.pin}
              onChange={(e) => set("pin", e.target.value)}
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={form.confirm}
              onChange={(e) => set("confirm", e.target.checked)}
            />
            I confirm the information belongs to me and is correct.
          </label>
        </>
      ) : null}

      <div className="form-row two">
        {onCancel ? (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Save and continue"}
        </button>
      </div>
    </form>
  );
}
