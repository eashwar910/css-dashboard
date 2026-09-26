// Who may change a task. The rules are in docs/PLAN.md, "Ownership rules".
// Every task write must check this server-side.

import type { PageObjectResponse } from '@notionhq/client';
import type { CommitteeMember } from './auth.js';
import { people } from './props.js';

export type TaskAction = 'toggle' | 'edit' | 'delete';

export type OwnershipReason =
  | 'admin' // committee_members.is_admin: always allowed
  | 'pic' // the member is one of the task's PIC people
  | 'unassigned-toggle' // no individual PIC; anyone may tick/untick
  | 'unassigned-admin-only' // no individual PIC; edit/delete needs admin
  | 'not-pic'; // assigned to other people

export interface OwnershipDecision {
  allowed: boolean;
  reason: OwnershipReason;
  /** Human-readable, safe to return in a 403 body. */
  message: string;
}

/** Exact name of the owner property on Team Dashboard > Tasks. */
export const TASK_PIC_PROPERTY = 'PIC';

export function canModifyTask(
  member: Pick<CommitteeMember, 'email' | 'notionEmail' | 'isAdmin'>,
  taskPage: Pick<PageObjectResponse, 'properties'>,
  action: TaskAction,
): OwnershipDecision {
  if (member.isAdmin) return { allowed: true, reason: 'admin', message: 'Admins can change any task' };

  const pic = people(taskPage, TASK_PIC_PROPERTY);
  const myEmails = new Set([member.email, member.notionEmail].filter(Boolean).map((e) => e!.toLowerCase()));
  if (pic.some((p) => p.email && myEmails.has(p.email.toLowerCase()))) {
    return { allowed: true, reason: 'pic', message: 'You are a PIC on this task' };
  }

  // Groups ("Everyone", departments) and bots aren't individual owners.
  // Partial users ('unknown') are a person we can't see the email of, so they still count.
  const hasIndividual = pic.some((p) => p.kind === 'person' || p.kind === 'unknown');
  if (!hasIndividual) {
    return action === 'toggle'
      ? { allowed: true, reason: 'unassigned-toggle', message: 'Any committee member can tick tasks with no individual PIC' }
      : {
          allowed: false,
          reason: 'unassigned-admin-only',
          message: `Only admins can ${action} tasks that aren't assigned to a specific person`,
        };
  }

  return { allowed: false, reason: 'not-pic', message: `You can only ${action} tasks where you are a PIC` };
}
