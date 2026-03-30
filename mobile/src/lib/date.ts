export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

export function getDayOfWeek(dateKey: string) {
  return fromDateKey(dateKey).getDay();
}

export function isTaskScheduledForDate(
  repeatType: 'DAILY' | 'WEEKLY_DAYS',
  repeatDays: number[],
  startDate: string,
  targetDate: string
) {
  if (targetDate < startDate) {
    return false;
  }

  if (repeatType === 'DAILY') {
    return true;
  }

  return repeatDays.includes(getDayOfWeek(targetDate));
}

export function addDays(dateKey: string, amount: number) {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function getWeekStart(dateKey: string) {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() - date.getDay());
  return toDateKey(date);
}

export function buildWeekGrid(dateKey: string) {
  const weekStart = fromDateKey(getWeekStart(dateKey));

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(weekStart);
    current.setDate(weekStart.getDate() + index);
    return toDateKey(current);
  });
}

export function getMonthStart(dateKey: string) {
  const date = fromDateKey(dateKey);
  date.setDate(1);
  return toDateKey(date);
}

export function shiftMonth(dateKey: string, amount: number) {
  const date = fromDateKey(dateKey);
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  return toDateKey(date);
}

export function getMonthLabel(dateKey: string) {
  const date = fromDateKey(dateKey);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function buildMonthGrid(dateKey: string) {
  const monthStart = fromDateKey(getMonthStart(dateKey));
  const firstDay = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - firstDay);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const totalVisibleDays = firstDay + monthEnd.getDate();
  const weekCount = Math.max(5, Math.ceil(totalVisibleDays / 7));

  return Array.from({ length: weekCount * 7 }, (_, index) => {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    return toDateKey(current);
  });
}

export function isSameMonth(baseDateKey: string, targetDateKey: string) {
  const base = fromDateKey(baseDateKey);
  const target = fromDateKey(targetDateKey);

  return (
    base.getFullYear() === target.getFullYear() &&
    base.getMonth() === target.getMonth()
  );
}
