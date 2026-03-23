export type TaskRepeatType = 'DAILY' | 'WEEKLY_DAYS';

export type TaskCategory = '운동' | '공부' | '생활' | '기타';

export type TaskTicketStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';

export type ReminderEventStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';

export type TaskTemplate = {
  id: string;
  title: string;
  category: TaskCategory;
  isActive: boolean;
  memo?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecurrenceRule = {
  id: string;
  templateId: string;
  repeatType: TaskRepeatType;
  repeatDays: number[];
  startsOn: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string,
  recurrenceRuleId: string,
  title: string,
  category: TaskCategory,
  repeatType: TaskRepeatType,
  repeatDays: number[],
  startsOn: string,
  isActive: boolean,
  memo?: string | null,
  createdAt: string,
  updatedAt: string,
};

export type TaskTicket = {
  id: string;
  templateId: string;
  recurrenceRuleId: string;
  reminderRuleId?: string | null;
  taskDate: string;
  status: TaskTicketStatus;
  openedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReminderRule = {
  id: string;
  templateId: string;
  delayMinutes: number;
  message: string;
  repeatIntervalMinutes?: number | null;
  maxAlertCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReminderEvent = {
  id: string;
  ruleId: string;
  taskTicketId: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: ReminderEventStatus;
  repeatIntervalMinutes?: number | null;
  maxAlertCount?: number | null;
  sentCount: number;
  completedAt?: string | null;
  notificationRequestId?: string | null;
};
