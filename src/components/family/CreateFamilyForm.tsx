import { useState } from "react";
import { Home, Plus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { SubmitButton } from "@/components/auth/SubmitButton";

interface Props {
  serverError?: string | null;
}

export default function CreateFamilyForm({ serverError }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  return (
    <form
      method="POST"
      action="/api/family/create"
      className="space-y-4"
      onSubmit={(event) => {
        if (!name.trim()) {
          event.preventDefault();
          setError("Enter a family name.");
        }
      }}
      noValidate
    >
      <FormField
        id="family-name"
        name="name"
        label="Family name"
        value={name}
        onChange={(value) => {
          setName(value);
          setError(undefined);
        }}
        placeholder="e.g. Kowalski"
        error={error}
        icon={<Home className="size-4" />}
      />
      <ServerError message={serverError} />
      <SubmitButton pendingText="Creating family..." icon={<Plus className="size-4" />}>
        Create family
      </SubmitButton>
    </form>
  );
}
