"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCompany } from "@/actions/company-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DeleteCompanyFormProps = {
  companyId: string;
  companyName: string;
  onDeleted: () => void;
};

function DeleteCompanyForm({ companyId, companyName, onDeleted }: DeleteCompanyFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(deleteCompany, null);

  useEffect(() => {
    if (!state?.ok) {
      return;
    }
    onDeleted();
    router.refresh();
  }, [state, onDeleted, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Delete company</DialogTitle>
        <DialogDescription>
          This permanently removes <span className="font-medium text-foreground">{companyName}</span> and all
          stored crawl, knowledge, and agent settings for this company. This cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <input type="hidden" name="companyId" value={companyId} />
      {state?.ok === false ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      <DialogFooter className="gap-2 sm:gap-0">
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? "Deleting…" : "Delete company"}
        </Button>
      </DialogFooter>
    </form>
  );
}

type DeleteCompanyDialogProps = {
  companyId: string;
  companyName: string;
};

export function DeleteCompanyDialog({ companyId, companyName }: DeleteCompanyDialogProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const handleDeleted = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setFormKey((k) => k + 1);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          <Trash2 data-icon="inline-start" className="size-3.5" aria-hidden />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton>
        <DeleteCompanyForm
          key={formKey}
          companyId={companyId}
          companyName={companyName}
          onDeleted={handleDeleted}
        />
      </DialogContent>
    </Dialog>
  );
}
