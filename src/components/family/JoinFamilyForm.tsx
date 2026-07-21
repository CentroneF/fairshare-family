import { useEffect, useRef, useState } from "react";
import { KeyRound, UsersRound } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";

interface PreviewResponse {
  familyName?: string;
  error?: string;
}

interface Props {
  serverError?: string | null;
}

function isPreviewResponse(value: unknown): value is PreviewResponse {
  return Boolean(value) && typeof value === "object";
}

export default function JoinFamilyForm({ serverError }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [familyName, setFamilyName] = useState<string>();
  const [isPreviewing, setIsPreviewing] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (familyName) confirmButtonRef.current?.focus();
  }, [familyName]);

  async function previewJoin(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPreviewing(true);

    try {
      const response = await fetch("/api/family/join/preview", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload: unknown = await response.json();

      if (!isPreviewResponse(payload)) {
        setError("We could not preview that family. Please try again.");
      } else if (!response.ok || typeof payload.error === "string") {
        setError(payload.error ?? "We could not preview that family. Please try again.");
      } else if (typeof payload.familyName === "string") {
        setFamilyName(payload.familyName);
      } else {
        setError("We could not preview that family. Please try again.");
      }
    } catch {
      setError("We could not preview that family. Please try again.");
    } finally {
      setIsPreviewing(false);
    }
  }

  function closeDialog() {
    setFamilyName(undefined);
    requestAnimationFrame(() => document.getElementById("family-code")?.focus());
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      closeDialog();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([type="hidden"]):not([disabled])',
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <form method="POST" className="space-y-4" onSubmit={previewJoin} noValidate>
        <FormField
          id="family-code"
          name="code"
          label="Family code"
          value={code}
          onChange={(value) => {
            setCode(value);
            setError(undefined);
          }}
          placeholder="Enter the 8-character code"
          error={error}
          icon={<KeyRound className="size-4" />}
        />
        <ServerError message={serverError} />
        <button
          type="submit"
          disabled={isPreviewing}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-300/50 bg-purple-500/20 px-4 py-2 font-medium text-purple-100 transition-colors hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UsersRound className="size-4" />
          {isPreviewing ? "Checking code..." : "Join a family"}
        </button>
      </form>

      {familyName && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-family-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onKeyDown={handleDialogKeyDown}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-6 text-white shadow-2xl">
            <h2 id="join-family-title" className="text-xl font-bold">
              Join family
            </h2>
            <p className="mt-3 text-blue-100/80">Do you want to join the {familyName} family?</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                onClick={closeDialog}
              >
                Cancel
              </button>
              <form method="POST" action="/api/family/join/confirm">
                <input type="hidden" name="code" value={code} />
                <button
                  ref={confirmButtonRef}
                  type="submit"
                  className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500 sm:w-auto"
                >
                  Join family
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
