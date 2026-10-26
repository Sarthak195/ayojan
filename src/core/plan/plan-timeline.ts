// The schedule side of a plan version (architecture 4.6, FR-12 to FR-14). Delays are absolute
// dates stored in the ops (D11), so the same link shows the same schedule on any later day; the
// faster alternatives come from the levers the plan applied (FR-33).

import type { IsoDate } from '@/core/calendar/day-number';

import { buildSchedule } from '../timeline/schedule';
import { delayPropagation, type DelayPropagation } from '../timeline/schedule-change';
import type { Schedule, ScheduleInput } from '../timeline/schedule-types';
import { thresholdsFrom } from '../timeline/status';
import { progressFromOps } from '../timeline/task-progress';
import type { PlanData } from './plan-data';
import type { PlanInputs } from './plan-inputs';
import { planFail, planOk, type PlanResult } from './plan-refusal';

export interface PlanTimeline {
  readonly schedule: Schedule;
  /** One entry per delayed task, in schedule order: what its delay pushed later. */
  readonly delayEffects: readonly DelayPropagation[];
}

export interface TimelineFacts {
  readonly eventDate: IsoDate;
  readonly today: IsoDate;
  readonly fasterTaskIds: readonly string[];
}

export function planTimeline(
  inputs: PlanInputs,
  facts: TimelineFacts,
  data: PlanData,
): PlanResult<PlanTimeline> {
  const { done, delays } = progressFromOps(inputs.ops);
  const input: ScheduleInput = {
    selection: inputs.selection,
    eventDate: facts.eventDate,
    today: facts.today,
    done,
    delays,
    faster: facts.fasterTaskIds,
    thresholds: thresholdsFrom(data.tasks),
  };
  const built = buildSchedule(input);
  if (!built.ok) return planFail({ kind: 'schedule', problem: built.problem });
  const delayed = new Set(delays.map((delay) => delay.taskId));
  const delayEffects: DelayPropagation[] = [];
  for (const task of built.schedule.tasks) {
    if (!delayed.has(task.id)) continue;
    // The same plan without this task's delays shows what the delays alone moved.
    const without = buildSchedule({
      ...input,
      delays: delays.filter((delay) => delay.taskId !== task.id),
    });
    if (!without.ok) return planFail({ kind: 'schedule', problem: without.problem });
    delayEffects.push(delayPropagation(without.schedule, built.schedule, task.id));
  }
  return planOk({ schedule: built.schedule, delayEffects });
}
