import { useState } from "react";
import { User } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  required: true;
}

export default function ParentProfileForm({ required: _required }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSaved(false);
    if (displayName.trim().length < 5 || displayName.trim().length > 15) {
      setError("Enter a display name between 5 and 15 characters.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/family/profile", { method: "POST", body: new FormData(event.currentTarget) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok || payload.error) {
        setError(payload.error ?? "We could not save your display name. Please try again.");
        return;
      }
      setSaved(true);
      window.location.reload();
    } catch {
      setError("We could not save your display name. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit} noValidate>
      <FormField
        id="displayName"
        label="Display name"
        value={displayName}
        onChange={(value) => {
          setDisplayName(value);
          setError(undefined);
          setSaved(false);
        }}
        placeholder="e.g. Anna Kowalska"
        error={error}
        hint={<p className="mt-1 text-xs text-blue-100/50">5–15 characters</p>}
        icon={<User className="size-4" />}
      />
      <ServerError message={error} />
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Continue"}
      </button>
      {saved && <p className="text-sm text-emerald-300">Display name saved.</p>}
    </form>
  );
}
