import { FileX2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Marks an event with no Event Proposal Form uploaded yet (the red twin of the green EPF badge). */
export function NoEpfBadge() {
  return (
    <Badge
      variant="outline"
      title="No EPF uploaded yet"
      className="border-destructive/40 bg-destructive/10 text-[10px] text-destructive"
    >
      <FileX2 className="mr-1 h-3 w-3" />
      NO EPF
    </Badge>
  );
}
