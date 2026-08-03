import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  stageTitle?: string;
};

/** CodeCrafters-style spoiler guard before viewing code examples on an incomplete stage. */
export function BuildExampleGate({ open, onOpenChange, onConfirm, stageTitle }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>View code examples?</AlertDialogTitle>
          <AlertDialogDescription>
            {stageTitle ? (
              <>
                You haven&apos;t completed <strong>{stageTitle}</strong> yet. Viewing examples may spoil the
                challenge. Try implementing it yourself first.
              </>
            ) : (
              <>You haven&apos;t completed this stage yet. Viewing examples may spoil the challenge.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back to instructions</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Show examples anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
