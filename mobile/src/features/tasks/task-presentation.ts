import type { TodayTaskItem } from '../../data/tasks';
import type { ReminderRule, TaskCategory, TaskTicketStatus } from '../../domain/types';
import { formatKoreanTime } from '../../lib/time';
import { fromDateKey } from '../../lib/date';

export const categories: TaskCategory[] = ['운동', '공부', '생활', '기타'];

export const weekdays = [
  { label: '일', value: 0 },
  { label: '월', value: 1 },
  { label: '화', value: 2 },
  { label: '수', value: 3 },
  { label: '목', value: 4 },
  { label: '금', value: 5 },
  { label: '토', value: 6 },
];

export const tabs = [
  { key: 'today', label: '오늘' },
  { key: 'calendar', label: '기록' },
  { key: 'tasks', label: '루틴' },
  { key: 'settings', label: '설정' },
] as const;

export type CalendarStatusFilter = 'ALL' | 'DONE' | 'PENDING' | 'IN_PROGRESS';
export type TaskStatusTone = 'pending' | 'inProgress' | 'done';

export function hasActiveReminderRule(rules: ReminderRule[], templateId: string) {
  return rules.some((rule) => rule.isActive && rule.templateId === templateId);
}

export function filterTaskItems(
  items: TodayTaskItem[],
  statusFilter: CalendarStatusFilter,
  categoryFilter: 'ALL' | TaskCategory
) {
  // 달력 셀, 선택 날짜 상세가 같은 필터 규칙을 공유한다.
  return items.filter((item) => {
    const matchesStatus = statusFilter === 'ALL' ? true : item.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' ? true : item.task.category === categoryFilter;

    return matchesStatus && matchesCategory;
  });
}

export function formatDelayMinutes(delayMinutes: number) {
  const hours = Math.floor(delayMinutes / 60);
  const minutes = delayMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  if (hours > 0) {
    return `${hours}시간`;
  }

  return `${minutes}분`;
}

export function formatRepeatDays(days: number[]) {
  return days
    .map((day) => weekdays.find((item) => item.value === day)?.label ?? String(day))
    .join(', ');
}

export function getTaskStatusLabel(status: TaskTicketStatus) {
  switch (status) {
    case 'PENDING':
      return '예정';
    case 'IN_PROGRESS':
      return '진행중';
    case 'DONE':
      return '완료';
    default:
      return status;
  }
}

export function getTaskStatusTone(status: TaskTicketStatus): TaskStatusTone {
  switch (status) {
    case 'DONE':
      return 'done';
    case 'IN_PROGRESS':
      return 'inProgress';
    default:
      return 'pending';
  }
}

export function getStatusActionLabel(item: TodayTaskItem, hasReminderRule: boolean) {
  if (item.status === 'DONE') {
    return '예정';
  }

  if (item.status === 'IN_PROGRESS') {
    return '완료';
  }

  return hasReminderRule ? '시작' : '완료';
}

export function getNextTaskStatus(
  currentStatus: TaskTicketStatus,
  hasLinkedRules: boolean
): TaskTicketStatus {
  // 알림 규칙이 있으면 시작 시 IN_PROGRESS 로 진입하고, 없으면 바로 DONE 처리한다.
  if (currentStatus === 'PENDING') {
    return hasLinkedRules ? 'IN_PROGRESS' : 'DONE';
  }

  if (currentStatus === 'IN_PROGRESS') {
    return 'DONE';
  }

  return 'PENDING';
}

export function getWeekdayLabel(dateKey: string) {
  return weekdays[fromDateKey(dateKey).getDay()]?.label ?? '';
}

export function formatOptionalTime(isoString?: string | null, emptyLabel = '-') {
  if (!isoString) {
    return emptyLabel;
  }

  return formatKoreanTime(isoString);
}
