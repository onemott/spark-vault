import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Snapshot } from '@/types';

/**
 * 快照回滚下拉菜单。依赖 @base-ui/react（Menu），故懒加载，
 * 使该依赖不在首次启动时加载。
 */
export interface SnapshotRollbackMenuProps {
  snapshots: Snapshot[];
  handleRollback: (snapshotId: number) => void;
}

export function SnapshotRollbackMenu({ snapshots, handleRollback }: SnapshotRollbackMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            title="从快照回滚"
          >
            <RotateCcw strokeWidth={1.5} />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {snapshots.map((snap) => (
          <DropdownMenuItem
            key={snap.id}
            onClick={() => handleRollback(snap.id!)}
          >
            {new Date(snap.createdAt).toLocaleString()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default SnapshotRollbackMenu;
