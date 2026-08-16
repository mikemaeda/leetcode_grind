export type CommitmentStatus = "PENDING" | "COMPLETED" | "WAIVER_PENDING" | "WAIVED" | "FAILED";
export function completionStatus(completedCount: number, requiredCount: number): CommitmentStatus { return completedCount >= requiredCount ? "COMPLETED" : "PENDING"; }
export function totalPenalty(perParticipant: number, activeMemberCount: number): number { return perParticipant * Math.max(0, activeMemberCount - 1); }
export function waiverCutoff(deadline: Date): Date { return new Date(deadline.getTime() - 2 * 60 * 60 * 1000); }
export function canRequestWaiver(now: Date, deadline: Date): boolean { return now.getTime() <= waiverCutoff(deadline).getTime(); }
