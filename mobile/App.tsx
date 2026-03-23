import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { initializeDatabase } from './src/data/database';
import {
  createTask,
  deactivateTask,
  ensureTodayTaskTickets,
  getTaskItemsForDate,
  getTaskItemsForDates,
  listActiveTasks,
  seedSampleTasks,
  setTaskStatus,
  updateTask,
  type TodayTaskItem,
} from './src/data/tasks';
import {
  createReminderRule,
  deactivateReminderRulesByTask,
  deactivateReminderRule,
  listReminderRules,
} from './src/data/reminders';
import {
  cancelPendingReminderEventsByTaskTicket,
  completeReminderEventCycle,
  cancelPendingReminderEventsByRelatedTask,
  createReminderEvent,
  listDueReminderEvents,
  listReminderEvents,
} from './src/data/reminder-events';
import type {
  ReminderRule,
  Task,
  TaskCategory,
  TaskRepeatType,
} from './src/domain/types';
import {
  addDays,
  buildWeekGrid,
  buildMonthGrid,
  fromDateKey,
  getMonthLabel,
  getMonthStart,
  getWeekStart,
  isSameMonth,
  shiftMonth,
  toDateKey,
} from './src/lib/date';
import {
  cancelScheduledNotification,
  calculateRepeatUntil,
  ensureNotificationPermissions,
  isExpoGo,
  scheduleReminderNotification,
} from './src/lib/notifications';
import { addMinutes, formatKoreanTime } from './src/lib/time';

const categories: TaskCategory[] = ['운동', '공부', '생활', '기타'];
const weekdays = [
  { label: '일', value: 0 },
  { label: '월', value: 1 },
  { label: '화', value: 2 },
  { label: '수', value: 3 },
  { label: '목', value: 4 },
  { label: '금', value: 5 },
  { label: '토', value: 6 },
];
const tabs = [
  { key: 'today', label: '오늘' },
  { key: 'calendar', label: '달력' },
  { key: 'tasks', label: '테스크' },
  { key: 'reminders', label: '알림' },
] as const;

type AppTab = (typeof tabs)[number]['key'];
type CalendarViewMode = 'MONTH' | 'WEEK';
type CalendarStatusFilter = 'ALL' | 'DONE' | 'PENDING' | 'IN_PROGRESS';

export default function App() {
  const reminderEngineRunningRef = useRef(false);
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [dbReady, setDbReady] = useState(false);
  const [permissionLabel, setPermissionLabel] = useState(
    isExpoGo() ? 'Expo Go에서는 알림 비활성화' : '알림 권한 확인 필요'
  );
  const [todayItems, setTodayItems] = useState<TodayTaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('생활');
  const [repeatType, setRepeatType] = useState<TaskRepeatType>('DAILY');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(getMonthStart(toDateKey(new Date())));
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('MONTH');
  const [calendarStatusFilter, setCalendarStatusFilter] = useState<CalendarStatusFilter>('ALL');
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<'ALL' | TaskCategory>('ALL');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(
    fromDateKey(toDateKey(new Date())).getFullYear()
  );
  const [selectedItems, setSelectedItems] = useState<TodayTaskItem[]>([]);
  const [calendarItemsByDate, setCalendarItemsByDate] = useState<Record<string, TodayTaskItem[]>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [ruleTriggerTaskId, setRuleTriggerTaskId] = useState('');
  const [ruleDelayHours, setRuleDelayHours] = useState('9');
  const [ruleDelayMinutes, setRuleDelayMinutes] = useState('0');
  const [ruleRepeatMinutes, setRuleRepeatMinutes] = useState('1');
  const [ruleMessage, setRuleMessage] = useState('');
  const [ruleFeedback, setRuleFeedback] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  const today = toDateKey(new Date());
  const monthGrid = buildMonthGrid(visibleMonth);
  const weekGrid = buildWeekGrid(selectedDate);
  const calendarGrid = calendarViewMode === 'MONTH' ? monthGrid : weekGrid;
  const weekStart = weekGrid[0];
  const weekEnd = weekGrid[weekGrid.length - 1];
  const weekStartDate = fromDateKey(weekStart);
  const weekEndDate = fromDateKey(weekEnd);
  const visibleCalendarLabel =
    calendarViewMode === 'MONTH'
      ? getMonthLabel(visibleMonth)
      : weekStartDate.getFullYear() === weekEndDate.getFullYear()
        ? `${weekStartDate.getFullYear()}년 ${weekStartDate.getMonth() + 1}/${weekStartDate.getDate()} - ${
            weekEndDate.getMonth() + 1
          }/${weekEndDate.getDate()}`
        : `${weekStartDate.getFullYear()}년 ${weekStartDate.getMonth() + 1}/${weekStartDate.getDate()} - ${
            weekEndDate.getFullYear()
          }년 ${weekEndDate.getMonth() + 1}/${weekEndDate.getDate()}`;
  const triggerTaskName =
    tasks.find((task) => task.id === ruleTriggerTaskId)?.title ?? '기준 테스크';
  const filteredSelectedItems = selectedItems.filter((item) => {
    const matchesStatus =
      calendarStatusFilter === 'ALL' ? true : item.status === calendarStatusFilter;
    const matchesCategory =
      calendarCategoryFilter === 'ALL' ? true : item.task.category === calendarCategoryFilter;

    return matchesStatus && matchesCategory;
  });
  const monthPickerLabel = `${monthPickerYear}년`;

  function filterCalendarItems(items: TodayTaskItem[]) {
    return items.filter((item) => {
      const matchesStatus =
        calendarStatusFilter === 'ALL' ? true : item.status === calendarStatusFilter;
      const matchesCategory =
        calendarCategoryFilter === 'ALL' ? true : item.task.category === calendarCategoryFilter;

      return matchesStatus && matchesCategory;
    });
  }

  function formatDelayMinutes(delayMinutes: number) {
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

  function formatRepeatDays(days: number[]) {
    return days
      .map((day) => weekdays.find((item) => item.value === day)?.label ?? String(day))
      .join(', ');
  }

  function getTaskStatusLabel(status: TodayTaskItem['status']) {
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

  function getWeekdayLabel(dateKey: string) {
    return weekdays[fromDateKey(dateKey).getDay()]?.label ?? '';
  }

  function formatOptionalTime(isoString?: string | null, emptyLabel = '-') {
    if (!isoString) {
      return emptyLabel;
    }

    return formatKoreanTime(isoString);
  }

  function resetTaskForm() {
    setEditingTaskId(null);
    setTitle('');
    setCategory('생활');
    setRepeatType('DAILY');
    setRepeatDays([1, 2, 3, 4, 5]);
  }

  function moveCalendar(amount: number) {
    if (calendarViewMode === 'MONTH') {
      const nextMonth = shiftMonth(visibleMonth, amount);
      const nextSelectedDate = nextMonth;

      setVisibleMonth(nextMonth);
      void handleSelectDate(nextSelectedDate, nextMonth);
      return;
    }

    const nextDate = addDays(selectedDate, amount * 7);
    const nextMonth = getMonthStart(nextDate);
    setVisibleMonth(nextMonth);
    void handleSelectDate(nextDate, nextMonth);
  }

  function jumpToToday() {
    setVisibleMonth(getMonthStart(today));
    void handleSelectDate(today, getMonthStart(today));
  }

  function openMonthPicker() {
    setMonthPickerYear(
      fromDateKey(calendarViewMode === 'MONTH' ? visibleMonth : selectedDate).getFullYear()
    );
    setShowMonthPicker(true);
  }

  function shiftMonthPickerYear(amount: number) {
    setMonthPickerYear((prev) => prev + amount);
  }

  async function handleSelectMonth(year: number, monthIndex: number) {
    const date = new Date(year, monthIndex, 1);
    const nextMonth = toDateKey(date);
    const nextSelectedDate = toDateKey(new Date(year, monthIndex, 1));

    setVisibleMonth(nextMonth);
    setShowMonthPicker(false);
    await handleSelectDate(nextSelectedDate, nextMonth);
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await initializeDatabase();
        await seedSampleTasks(today);
        await ensureTodayTaskTickets(today);
        await runReminderRescheduleEngine();

        const [items, itemsByDate] = await Promise.all([
          getTaskItemsForDate(today),
          getTaskItemsForDates(buildMonthGrid(visibleMonth)),
        ]);
        const [allTasks, allRules] = await Promise.all([
          listActiveTasks(),
          listReminderRules(),
        ]);

        if (!active) {
          return;
        }

        setDbReady(true);
        setTodayItems(items);
        setSelectedItems(items);
        setCalendarItemsByDate(itemsByDate);
        setTasks(allTasks);
        setRules(allRules);

        if (allTasks[0]) {
          setRuleTriggerTaskId(allTasks[0].id);
          setRuleMessage(`${allTasks[0].title} 종료 후 체크가 필요한지 확인해주세요.`);
        }
      } catch {
        if (!active) {
          return;
        }

        setPermissionLabel('초기 데이터 로딩 중 오류 발생');
      } finally {
        if (active) {
          setLoadingTasks(false);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void runReminderRescheduleEngine();
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  async function refreshTaskViews(dateKey: string, monthKey: string) {
    if (dateKey === today) {
      await ensureTodayTaskTickets(today);
    }

    const [items, itemsByDate] = await Promise.all([
      getTaskItemsForDate(dateKey),
      getTaskItemsForDates(buildMonthGrid(monthKey)),
    ]);

    setSelectedItems(items);
    setCalendarItemsByDate(itemsByDate);

    if (dateKey === today) {
      setTodayItems(items);
    }
  }

  async function refreshMetadata() {
    const [allTasks, allRules] = await Promise.all([
      listActiveTasks(),
      listReminderRules(),
    ]);

    setTasks(allTasks);
    setRules(allRules);

    if (!allTasks.some((task) => task.id === ruleTriggerTaskId)) {
      setRuleTriggerTaskId(allTasks[0]?.id ?? '');
    }
  }

  async function runReminderRescheduleEngine() {
    if (reminderEngineRunningRef.current) {
      return;
    }

    reminderEngineRunningRef.current = true;

    try {
      const nowIso = new Date().toISOString();
      const [dueEvents, allRules] = await Promise.all([
        listDueReminderEvents(nowIso),
        listReminderRules(),
      ]);

      if (dueEvents.length === 0) {
        return;
      }

      const ruleMap = new Map(allRules.map((rule) => [rule.id, rule]));

      for (const event of dueEvents) {
        const rule = ruleMap.get(event.ruleId);
        const intervalMinutes = event.repeatIntervalMinutes ?? rule?.repeatIntervalMinutes ?? null;

        if (!rule || !intervalMinutes || intervalMinutes <= 0) {
          await completeReminderEventCycle({
            eventId: event.id,
            sentAt: nowIso,
          });
          continue;
        }

        let nextScheduledAt = addMinutes(event.scheduledAt, intervalMinutes);
        while (nextScheduledAt <= nowIso) {
          nextScheduledAt = addMinutes(nextScheduledAt, intervalMinutes);
        }

        if (event.repeatUntil && nextScheduledAt > event.repeatUntil) {
          await completeReminderEventCycle({
            eventId: event.id,
            sentAt: nowIso,
          });
          continue;
        }

        const notificationRequestId = await scheduleReminderNotification({
          title: '루틴 체크 알림',
          body: rule.message,
          scheduledAt: nextScheduledAt,
        });

        await completeReminderEventCycle({
          eventId: event.id,
          sentAt: nowIso,
          nextScheduledAt,
          notificationRequestId,
        });
      }

    } finally {
      reminderEngineRunningRef.current = false;
    }
  }

  async function handlePermissionPress() {
    const permission = await ensureNotificationPermissions();
    setPermissionLabel(
      isExpoGo()
        ? 'Expo Go에서는 알림 비활성화'
        : permission.granted
          ? '알림 권한 허용됨'
          : '알림 권한 미허용'
    );
  }

  async function handleStatusPress(
    ticketId: string,
    templateId: string,
    currentStatus: TodayTaskItem['status'],
    dateKey: string
  ) {
    const hasLinkedRules = rules.some((rule) => rule.isActive && rule.templateId === templateId);
    const nextStatus =
      currentStatus === 'PENDING'
        ? hasLinkedRules
          ? 'IN_PROGRESS'
          : 'DONE'
        : 'PENDING';
    const ticket = await setTaskStatus(ticketId, nextStatus);

    if (currentStatus === 'IN_PROGRESS' || currentStatus === 'DONE') {
      const canceledEvents = await cancelPendingReminderEventsByTaskTicket(ticketId);
      await Promise.all(
        canceledEvents.map((event) =>
          event.notificationRequestId
            ? cancelScheduledNotification(event.notificationRequestId)
            : Promise.resolve()
        )
      );
    }

    await refreshTaskViews(dateKey, visibleMonth);

    if (nextStatus === 'IN_PROGRESS' && ticket?.openedAt) {
      const matchedRules = rules.filter((rule) => rule.isActive && rule.templateId === templateId);

      for (const rule of matchedRules) {
        const scheduledAt = addMinutes(ticket.openedAt, rule.delayMinutes);
        const notificationRequestId = await scheduleReminderNotification({
          title: '루틴 체크 알림',
          body: rule.message,
          scheduledAt,
        });

        await createReminderEvent({
          ruleId: rule.id,
          taskTicketId: ticket.id,
          scheduledAt,
          repeatIntervalMinutes: rule.repeatIntervalMinutes ?? null,
          repeatUntil: calculateRepeatUntil(ticket.openedAt, rule.delayMinutes),
          notificationRequestId,
        });
      }

      await refreshTaskViews(dateKey, visibleMonth);
      return;
    }

    await runReminderRescheduleEngine();
  }

  function toggleRepeatDay(day: number) {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()
    );
  }

  async function handleCreateTask() {
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      setFormMessage('테스크 이름을 입력해주세요.');
      return;
    }

    if (repeatType === 'WEEKLY_DAYS' && repeatDays.length === 0) {
      setFormMessage('요일 반복은 최소 1개 요일을 선택해야 합니다.');
      return;
    }

    setSavingTask(true);
    setFormMessage('');

    try {
      if (editingTaskId) {
        await updateTask(editingTaskId, {
          title: normalizedTitle,
          category,
          repeatType,
          repeatDays,
        });
      } else {
        await createTask({
          title: normalizedTitle,
          category,
          repeatType,
          repeatDays,
          startDate: today,
        });
      }

      await refreshTaskViews(selectedDate, visibleMonth);
      await refreshMetadata();

      if (!editingTaskId) {
        const allTasks = await listActiveTasks();
        if (!ruleTriggerTaskId && allTasks[0]) {
          setRuleTriggerTaskId(allTasks[0].id);
          setRuleMessage(`${allTasks[0].title} 종료 후 체크가 필요한지 확인해주세요.`);
        }
      }

      resetTaskForm();
      setFormMessage(editingTaskId ? '테스크를 수정했습니다.' : '새 테스크를 추가했습니다.');
    } catch {
      setFormMessage(editingTaskId ? '테스크 수정 중 오류가 발생했습니다.' : '테스크 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingTask(false);
    }
  }

  function handleEditTask(task: Task) {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setCategory(task.category);
    setRepeatType(task.repeatType);
    setRepeatDays(task.repeatType === 'WEEKLY_DAYS' ? task.repeatDays : [1, 2, 3, 4, 5]);
    setFormMessage('수정할 내용을 바꾼 뒤 저장해주세요.');
    setActiveTab('tasks');
  }

  async function handleDeactivateTask(task: Task) {
    setFormMessage('');

    const canceledEvents = await cancelPendingReminderEventsByRelatedTask(task.id);
    await Promise.all(
      canceledEvents.map((event) =>
        event.notificationRequestId
          ? cancelScheduledNotification(event.notificationRequestId)
          : Promise.resolve()
      )
    );

    await deactivateReminderRulesByTask(task.id);
    await deactivateTask(task.id);
    await refreshTaskViews(selectedDate, visibleMonth);
    await refreshMetadata();

    if (ruleTriggerTaskId === task.id) {
      setRuleTriggerTaskId('');
    }

    if (editingTaskId === task.id) {
      resetTaskForm();
    }

    setFormMessage('테스크를 비활성화했습니다.');
  }

  async function handleSelectDate(dateKey: string, monthKey = getMonthStart(dateKey)) {
    setSelectedDate(dateKey);
    setVisibleMonth(monthKey);
    await refreshTaskViews(dateKey, monthKey);
  }

  async function handleCreateRule() {
    const delayHours = Number(ruleDelayHours);
    const delayMinutesPart = Number(ruleDelayMinutes);
    const repeatMinutes = Number(ruleRepeatMinutes);
    const totalDelayMinutes = delayHours * 60 + delayMinutesPart;

    if (!ruleTriggerTaskId) {
      setRuleFeedback('기준 테스크를 선택해주세요.');
      return;
    }

    if (!ruleMessage.trim()) {
      setRuleFeedback('알림 메시지를 입력해주세요.');
      return;
    }

    if (
      !Number.isFinite(delayHours) ||
      delayHours < 0 ||
      !Number.isFinite(delayMinutesPart) ||
      delayMinutesPart < 0 ||
      delayMinutesPart >= 60
    ) {
      setRuleFeedback('지연 시간은 0시간 이상, 분은 0~59 범위로 입력해주세요.');
      return;
    }

    if (totalDelayMinutes < 1) {
      setRuleFeedback('지연 시간은 최소 1분 이상이어야 합니다.');
      return;
    }

    if (!Number.isFinite(repeatMinutes) || repeatMinutes <= 0) {
      setRuleFeedback('반복 간격은 1분 이상이어야 합니다.');
      return;
    }

    if (rules.some((rule) => rule.isActive && rule.templateId === ruleTriggerTaskId)) {
      setRuleFeedback('테스크당 알림 규칙은 1개만 연결할 수 있습니다.');
      return;
    }

    setSavingRule(true);
    setRuleFeedback('');

    try {
      await createReminderRule({
        templateId: ruleTriggerTaskId,
        delayMinutes: totalDelayMinutes,
        repeatIntervalMinutes: repeatMinutes,
        message: ruleMessage,
      });

      const allRules = await listReminderRules();
      setRules(allRules);
      setRuleFeedback('알림 규칙을 추가했습니다.');
    } catch (error) {
      if (error instanceof Error && error.message === 'ONLY_ONE_REMINDER_RULE_PER_TASK') {
        setRuleFeedback('테스크당 알림 규칙은 1개만 연결할 수 있습니다.');
      } else {
        setRuleFeedback('알림 규칙 저장 중 오류가 발생했습니다.');
      }
    } finally {
      setSavingRule(false);
    }
  }

  async function handleDeactivateRule(ruleId: string) {
    await deactivateReminderRule(ruleId);
    await refreshMetadata();
    await runReminderRescheduleEngine();
  }

  const calendarPanResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dy) < 20,
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx <= -40) {
        moveCalendar(1);
      } else if (gestureState.dx >= 40) {
        moveCalendar(-1);
      }
    },
  });
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Routine Check</Text>
          <Text style={styles.title}>Android MVP 준비 완료</Text>
          <Text style={styles.subtitle}>
            반복 테스크, 달력 기록, 지연 알림, 반복 리마인드 알림을 위한 앱 베이스를
            만들었습니다.
          </Text>
        </View>

        <View style={styles.tabRow}>
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;

            return (
              <Pressable
                key={tab.key}
                style={[
                  styles.tabButton,
                  selected ? styles.tabButtonActive : styles.tabButtonInactive,
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    selected ? styles.tabButtonTextActive : styles.tabButtonTextInactive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'today' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>오늘의 테스크</Text>
            <Text style={styles.caption}>{`${today} (${getWeekdayLabel(today)})`}</Text>
            {loadingTasks ? (
              <ActivityIndicator color="#f59e0b" />
            ) : (
              todayItems.map((item) => (
                <View key={item.task.id} style={styles.taskCard}>
                  <View style={styles.taskMeta}>
                    <View style={styles.taskHeaderRow}>
                      <Text style={styles.taskTitle}>{item.task.title}</Text>
                      <View style={styles.taskCategoryBadge}>
                        <Text style={styles.taskCategory}>{item.task.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.taskRepeat}>
                      상태: {getTaskStatusLabel(item.status)}
                    </Text>
                    {item.status === 'DONE' ? (
                      <Text style={styles.taskRepeat}>
                        완료시간: {formatOptionalTime(item.checkedAt)}
                      </Text>
                    ) : null}
                    {rules.some((rule) => rule.isActive && rule.templateId === item.task.id) ? (
                      <Text style={styles.taskRepeat}>
                        알림 종료시간: {formatOptionalTime(item.reminderEndAt, '없음')}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={[
                      styles.statusButton,
                      item.status === 'DONE'
                        ? styles.statusDone
                        : item.status === 'IN_PROGRESS'
                          ? styles.statusInProgress
                          : styles.statusPending,
                    ]}
                    onPress={() =>
                      handleStatusPress(item.ticket.id, item.task.id, item.status, today)
                    }
                  >
                    <Text style={styles.statusButtonText}>
                      {item.status === 'DONE'
                        ? '완료됨'
                        : item.status === 'IN_PROGRESS'
                          ? '진행중'
                          : rules.some((rule) => rule.isActive && rule.templateId === item.task.id)
                            ? '시작'
                            : '완료 체크'}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
            {!loadingTasks && todayItems.length === 0 ? (
              <Text style={styles.emptyText}>오늘 표시할 테스크가 없습니다.</Text>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'calendar' ? (
          <>
            <View style={styles.panel}>
              <View style={styles.calendarHeader}>
                <Pressable style={styles.monthButton} onPress={() => moveCalendar(-1)}>
                  <Text style={styles.monthButtonText}>이전</Text>
                </Pressable>
                <Pressable style={styles.calendarTitleButton} onPress={openMonthPicker}>
                  <Text style={styles.panelTitle}>{visibleCalendarLabel}</Text>
                </Pressable>
                <Pressable style={styles.monthButton} onPress={() => moveCalendar(1)}>
                  <Text style={styles.monthButtonText}>다음</Text>
                </Pressable>
              </View>

              <View style={styles.calendarToolbar}>
                <View style={styles.segmentedControl}>
                  <Pressable
                    style={[
                      styles.segmentedItem,
                      calendarViewMode === 'MONTH' && styles.segmentedItemActive,
                    ]}
                    onPress={() => setCalendarViewMode('MONTH')}
                  >
                    <Text
                      style={[
                        styles.segmentedText,
                        calendarViewMode === 'MONTH'
                          ? styles.segmentedTextActive
                          : styles.segmentedTextInactive,
                      ]}
                    >
                      월
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.segmentedItem,
                      calendarViewMode === 'WEEK' && styles.segmentedItemActive,
                    ]}
                    onPress={() => setCalendarViewMode('WEEK')}
                  >
                    <Text
                      style={[
                        styles.segmentedText,
                        calendarViewMode === 'WEEK'
                          ? styles.segmentedTextActive
                          : styles.segmentedTextInactive,
                      ]}
                    >
                      주
                    </Text>
                  </Pressable>
                </View>
                <Pressable style={styles.todayPill} onPress={jumpToToday}>
                  <Text style={styles.todayPillText}>오늘</Text>
                </Pressable>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.fieldLabel}>달력 필터</Text>
                <View style={styles.filterBlock}>
                  <Text style={styles.filterLabel}>상태</Text>
                  <View style={styles.segmentedControlWide}>
                    {(['ALL', 'PENDING', 'IN_PROGRESS', 'DONE'] as CalendarStatusFilter[]).map((status) => (
                      <Pressable
                        key={status}
                        style={[
                          styles.segmentedItemFill,
                          calendarStatusFilter === status && styles.segmentedItemActive,
                        ]}
                        onPress={() => setCalendarStatusFilter(status)}
                      >
                        <Text
                          style={[
                            styles.segmentedText,
                            calendarStatusFilter === status
                              ? styles.segmentedTextActive
                              : styles.segmentedTextInactive,
                          ]}
                        >
                          {status === 'ALL'
                            ? '전체'
                            : status === 'DONE'
                              ? '완료'
                              : status === 'IN_PROGRESS'
                                ? '진행중'
                                : '예정'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.filterBlock}>
                  <Text style={styles.filterLabel}>카테고리</Text>
                  <View style={styles.filterChipRow}>
                    {(['ALL', ...categories] as Array<'ALL' | TaskCategory>).map((item) => (
                      <Pressable
                        key={item}
                        style={[
                          styles.filterChip,
                          calendarCategoryFilter === item ? styles.filterChipActive : styles.filterChipInactive,
                        ]}
                        onPress={() => setCalendarCategoryFilter(item)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            calendarCategoryFilter === item
                              ? styles.filterChipTextActive
                              : styles.filterChipTextInactive,
                          ]}
                        >
                          {item === 'ALL' ? '전체' : item}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.weekHeaderRow}>
                {weekdays.map((day) => (
                  <Text key={day.value} style={styles.weekHeaderText}>
                    {day.label}
                  </Text>
                ))}
              </View>

              <View
                style={[
                  styles.calendarGrid,
                  calendarViewMode === 'WEEK' && styles.calendarGridWeek,
                ]}
                {...calendarPanResponder.panHandlers}
              >
                {calendarGrid.map((dateKey) => {
                  const dayItems = filterCalendarItems(calendarItemsByDate[dateKey] ?? []);
                  const inCurrentMonth = isSameMonth(visibleMonth, dateKey);
                  const selected = dateKey === selectedDate;
                  const isToday = dateKey === today;
                  const doneCount = dayItems.filter((item) => item.status === 'DONE').length;
                  const rate = dayItems.length > 0 ? `${doneCount}/${dayItems.length}` : '-';
                  const completionRate = dayItems.length > 0 ? doneCount / dayItems.length : 0;

                  return (
                    <Pressable
                      key={dateKey}
                      style={[
                        styles.calendarCell,
                        calendarViewMode === 'WEEK' && styles.calendarCellWeek,
                        calendarViewMode === 'MONTH' && !inCurrentMonth && styles.calendarCellMuted,
                        selected && styles.calendarCellSelected,
                        isToday && styles.calendarTodayCell,
                      ]}
                      onPress={() => handleSelectDate(dateKey)}
                    >
                      <Text
                        style={[
                          styles.calendarDay,
                          calendarViewMode === 'MONTH' && !inCurrentMonth && styles.calendarTextMuted,
                          selected && styles.calendarTextSelected,
                          isToday && styles.calendarToday,
                        ]}
                      >
                        {dateKey.slice(-2)}
                      </Text>
                      <Text
                        style={[
                          styles.calendarRate,
                          dayItems.length > 0 && styles.calendarRateActive,
                          !inCurrentMonth && styles.calendarTextMuted,
                          selected && styles.calendarTextSelected,
                        ]}
                      >
                        {rate}
                      </Text>
                      <View style={styles.calendarProgressTrack}>
                        <View
                          style={[
                            styles.calendarProgressFill,
                            { width: `${completionRate * 100}%` },
                            selected && styles.calendarProgressFillSelected,
                          ]}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>선택 날짜 상세</Text>
              <Text style={styles.caption}>{selectedDate}</Text>
              {filteredSelectedItems.map((item) => (
                <View key={item.ticket.id} style={styles.taskCard}>
                  <View style={styles.taskMeta}>
                    <Text style={styles.taskCategory}>{item.task.category}</Text>
                    <Text style={styles.taskTitle}>{item.task.title}</Text>
                    <Text style={styles.taskRepeat}>상태: {getTaskStatusLabel(item.status)}</Text>
                    {item.status === 'DONE' ? (
                      <Text style={styles.taskRepeat}>완료시간: {formatOptionalTime(item.checkedAt)}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={[
                      styles.statusButton,
                      item.status === 'DONE'
                        ? styles.statusDone
                        : item.status === 'IN_PROGRESS'
                          ? styles.statusInProgress
                          : styles.statusPending,
                    ]}
                    onPress={() =>
                      handleStatusPress(item.ticket.id, item.task.id, item.status, selectedDate)
                    }
                  >
                    <Text style={styles.statusButtonText}>
                      {item.status === 'DONE'
                        ? '완료됨'
                        : item.status === 'IN_PROGRESS'
                          ? '진행중'
                          : rules.some((rule) => rule.isActive && rule.templateId === item.task.id)
                            ? '시작'
                            : '완료 체크'}
                    </Text>
                  </Pressable>
                </View>
              ))}
              {filteredSelectedItems.length === 0 ? (
                <Text style={styles.emptyText}>선택한 날짜에 필터 조건과 맞는 테스크가 없습니다.</Text>
              ) : null}
            </View>

            <Modal
              animationType="fade"
              transparent
              visible={showMonthPicker}
              onRequestClose={() => setShowMonthPicker(false)}
            >
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <View style={styles.calendarHeader}>
                    <Text style={styles.panelTitle}>{monthPickerLabel}</Text>
                    <Pressable onPress={() => setShowMonthPicker(false)}>
                      <Text style={styles.monthButtonText}>닫기</Text>
                    </Pressable>
                  </View>
                  <View style={styles.monthPickerYearToolbar}>
                    <Pressable style={styles.monthButton} onPress={() => shiftMonthPickerYear(-1)}>
                      <Text style={styles.monthButtonText}>이전 연도</Text>
                    </Pressable>
                    <Text style={styles.fieldLabel}>{monthPickerYear}년</Text>
                    <Pressable style={styles.monthButton} onPress={() => shiftMonthPickerYear(1)}>
                      <Text style={styles.monthButtonText}>다음 연도</Text>
                    </Pressable>
                  </View>
                  <View style={styles.monthPickerSection}>
                    <Text style={styles.fieldLabel}>월 선택</Text>
                    <View style={styles.monthPickerGrid}>
                      {Array.from({ length: 12 }, (_, monthIndex) => (
                        <Pressable
                          key={`${monthPickerYear}-${monthIndex}`}
                          style={styles.monthPickerCell}
                          onPress={() => handleSelectMonth(monthPickerYear, monthIndex)}
                        >
                          <Text style={styles.monthButtonText}>{monthIndex + 1}월</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        ) : null}

        {activeTab === 'tasks' ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                {editingTaskId ? '테스크 수정' : '새 테스크 추가'}
              </Text>
              <TextInput
                placeholder="예: 퇴근 체크"
                placeholderTextColor="#6b7280"
                style={styles.input}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.fieldLabel}>카테고리</Text>
              <View style={styles.chipRow}>
                {categories.map((item) => (
                  <Pressable
                    key={item}
                    style={[styles.chip, category === item ? styles.chipActive : styles.chipInactive]}
                    onPress={() => setCategory(item)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        category === item ? styles.chipTextActive : styles.chipTextInactive,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>반복 방식</Text>
              <View style={styles.chipRow}>
                {(['DAILY', 'WEEKLY_DAYS'] as TaskRepeatType[]).map((item) => (
                  <Pressable
                    key={item}
                    style={[
                      styles.chip,
                      repeatType === item ? styles.chipActive : styles.chipInactive,
                    ]}
                    onPress={() => setRepeatType(item)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        repeatType === item ? styles.chipTextActive : styles.chipTextInactive,
                      ]}
                    >
                      {item === 'DAILY' ? '매일' : '요일 반복'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {repeatType === 'WEEKLY_DAYS' ? (
                <>
                  <Text style={styles.fieldLabel}>반복 요일</Text>
                  <View style={styles.chipRow}>
                    {weekdays.map((day) => {
                      const selected = repeatDays.includes(day.value);
                      return (
                        <Pressable
                          key={day.value}
                          style={[
                            styles.dayChip,
                            selected ? styles.chipActive : styles.chipInactive,
                          ]}
                          onPress={() => toggleRepeatDay(day.value)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              selected ? styles.chipTextActive : styles.chipTextInactive,
                            ]}
                          >
                            {day.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <View style={styles.inlineActionRow}>
                <Pressable style={styles.buttonFlex} onPress={handleCreateTask} disabled={savingTask}>
                  <Text style={styles.buttonText}>
                    {savingTask ? '저장 중...' : editingTaskId ? '수정 저장' : '테스크 추가'}
                  </Text>
                </Pressable>
                {editingTaskId ? (
                  <Pressable style={styles.secondaryButton} onPress={resetTaskForm}>
                    <Text style={styles.secondaryButtonText}>취소</Text>
                  </Pressable>
                ) : null}
              </View>
              {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>활성 테스크</Text>
              {tasks.length > 0 ? (
                <View style={styles.ruleList}>
                  {tasks.map((task) => (
                    <View key={task.id} style={styles.ruleCard}>
                      <View style={styles.taskMeta}>
                        <View style={styles.taskHeaderRow}>
                          <Text style={styles.taskTitle}>{task.title}</Text>
                          <View style={styles.taskCategoryBadge}>
                            <Text style={styles.taskCategory}>{task.category}</Text>
                          </View>
                        </View>
                        <Text style={styles.taskRepeat}>
                          {task.repeatType === 'DAILY'
                            ? '매일'
                            : `요일 반복: ${formatRepeatDays(task.repeatDays)}`}
                        </Text>
                      </View>
                      <View style={styles.inlineActionRow}>
                        <Pressable
                          style={[styles.statusButton, styles.editButton, styles.flexButton]}
                          onPress={() => handleEditTask(task)}
                        >
                          <Text style={styles.statusButtonText}>수정</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.statusButton, styles.deleteButton, styles.flexButton]}
                          onPress={() => handleDeactivateTask(task)}
                        >
                          <Text style={styles.statusButtonText}>삭제</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>활성 테스크가 없습니다.</Text>
              )}
            </View>
          </>
        ) : null}

        {activeTab === 'reminders' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>알림 규칙</Text>
            <Text style={styles.caption}>
              특정 테스크 종료 후 일정 시간이 지나면 알림을 시작하고, 해제 전까지 반복할 수
              있습니다.
            </Text>

            <Text style={styles.fieldLabel}>기준 테스크</Text>
            <View style={styles.chipRow}>
              {tasks.map((task) => (
                <Pressable
                  key={task.id}
                  style={[
                    styles.chip,
                    ruleTriggerTaskId === task.id ? styles.chipActive : styles.chipInactive,
                  ]}
                  onPress={() => {
                    setRuleTriggerTaskId(task.id);
                    if (!ruleMessage.trim()) {
                      setRuleMessage(`${task.title} 종료 후 체크가 필요한지 확인해주세요.`);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      ruleTriggerTaskId === task.id
                        ? styles.chipTextActive
                        : styles.chipTextInactive,
                    ]}
                  >
                    {task.title}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inlineInputs}>
              <View style={styles.delayInputGroup}>
                <View style={styles.delayInputBox}>
                  <Text style={styles.fieldLabel}>지연 시간(시간)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={ruleDelayHours}
                    onChangeText={setRuleDelayHours}
                  />
                </View>
                <View style={styles.delayInputBox}>
                  <Text style={styles.fieldLabel}>지연 시간(분)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={ruleDelayMinutes}
                    onChangeText={setRuleDelayMinutes}
                  />
                </View>
              </View>
              <View style={styles.repeatInputBox}>
                <Text style={styles.fieldLabel}>반복 간격(분)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={ruleRepeatMinutes}
                  onChangeText={setRuleRepeatMinutes}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>알림 메시지</Text>
            <TextInput
              style={styles.input}
              value={ruleMessage}
              onChangeText={setRuleMessage}
              placeholder={`${triggerTaskName} 종료 후 체크가 필요한지 확인해주세요.`}
              placeholderTextColor="#6b7280"
            />

            <Pressable style={styles.button} onPress={handleCreateRule} disabled={savingRule}>
              <Text style={styles.buttonText}>{savingRule ? '저장 중...' : '알림 규칙 추가'}</Text>
            </Pressable>
            {ruleFeedback ? <Text style={styles.formMessage}>{ruleFeedback}</Text> : null}

            {rules.length > 0 ? (
              <View style={styles.ruleList}>
                {rules.map((rule) => {
                  const trigger = tasks.find((task) => task.id === rule.templateId)?.title ?? '-';

                  return (
                    <View key={rule.id} style={styles.ruleCard}>
                      <View style={styles.taskMeta}>
                        <Text style={styles.taskCategory}>기준: {trigger}</Text>
                        <Text style={styles.taskTitle}>{rule.message}</Text>
                        <Text style={styles.taskRepeat}>
                          {formatDelayMinutes(rule.delayMinutes)} 후 시작 /{' '}
                          {rule.repeatIntervalMinutes ?? '-'}분 간격
                        </Text>
                        <Text style={styles.taskRepeat}>종료 조건: 수동 해제</Text>
                      </View>
                      <Pressable
                        style={[styles.statusButton, styles.deleteButton]}
                        onPress={() => handleDeactivateRule(rule.id)}
                      >
                        <Text style={styles.statusButtonText}>비활성화</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  hero: {
    paddingTop: 16,
    gap: 10,
  },
  eyebrow: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f9fafb',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: {
    color: '#d1d5db',
    fontSize: 15,
    lineHeight: 22,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabButton: {
    flexGrow: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  tabButtonInactive: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: '#111827',
  },
  tabButtonTextInactive: {
    color: '#e5e7eb',
  },
  panel: {
    backgroundColor: '#1f2937',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  panelTitle: {
    color: '#f9fafb',
    fontSize: 18,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  label: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  value: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  button: {
    marginTop: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  buttonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  buttonFlex: {
    flex: 1,
    marginTop: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryButton: {
    marginTop: 4,
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  item: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  taskCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 14,
    gap: 12,
  },
  taskMeta: {
    gap: 4,
  },
  taskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  taskCategoryBadge: {
    backgroundColor: '#2d3748',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignSelf: 'flex-start',
  },
  taskCategory: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
  },
  taskTitle: {
    color: '#f9fafb',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  taskRepeat: {
    color: '#9ca3af',
    fontSize: 13,
  },
  statusButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statusPending: {
    backgroundColor: '#2563eb',
  },
  statusDone: {
    backgroundColor: '#059669',
  },
  statusInProgress: {
    backgroundColor: '#b45309',
  },
  deleteButton: {
    backgroundColor: '#7f1d1d',
  },
  editButton: {
    backgroundColor: '#374151',
  },
  flexButton: {
    flex: 1,
  },
  statusButtonText: {
    color: '#f9fafb',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  monthButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  monthButtonText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '700',
  },
  calendarTitleButton: {
    alignItems: 'center',
  },
  calendarToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 4,
  },
  segmentedControlWide: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 4,
  },
  segmentedItem: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segmentedItemFill: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentedItemActive: {
    backgroundColor: '#f59e0b',
  },
  segmentedText: {
    fontSize: 12,
    fontWeight: '800',
  },
  segmentedTextActive: {
    color: '#111827',
  },
  segmentedTextInactive: {
    color: '#d1d5db',
  },
  todayPill: {
    backgroundColor: '#111827',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  todayPillText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '800',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekHeaderText: {
    width: '14.28%',
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  calendarGridWeek: {
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    gap: 0,
  },
  calendarCell: {
    width: '13.9%',
    minHeight: 84,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarCellWeek: {
    flexGrow: 0,
    flexShrink: 0,
    width: '13.4%',
    minHeight: 168,
    alignItems: 'flex-start',
    paddingHorizontal: 6,
  },
  calendarCellMuted: {
    opacity: 0.45,
  },
  calendarCellSelected: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  calendarTodayCell: {
    borderColor: '#f59e0b',
  },
  calendarDay: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '800',
  },
  calendarRate: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '800',
  },
  calendarRateActive: {
    color: '#f9fafb',
  },
  calendarTextMuted: {
    color: '#6b7280',
  },
  calendarTextSelected: {
    color: '#111827',
  },
  calendarToday: {
    textDecorationLine: 'underline',
  },
  calendarProgressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#253043',
    overflow: 'hidden',
  },
  calendarProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#f59e0b',
  },
  calendarProgressFillSelected: {
    backgroundColor: '#111827',
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    color: '#f9fafb',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldLabel: {
    color: '#d1d5db',
    fontSize: 13,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterSection: {
    gap: 8,
  },
  filterBlock: {
    gap: 6,
  },
  filterLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  filterChipInactive: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#111827',
  },
  filterChipTextInactive: {
    color: '#e5e7eb',
  },
  delayInputGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  delayInputBox: {
    flex: 1,
    gap: 6,
  },
  repeatInputBox: {
    width: 110,
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayChip: {
    minWidth: 40,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  chipInactive: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#111827',
  },
  chipTextInactive: {
    color: '#e5e7eb',
  },
  formMessage: {
    color: '#d1d5db',
    fontSize: 13,
  },
  ruleList: {
    gap: 10,
  },
  ruleCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 14,
    gap: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    maxHeight: '75%',
    backgroundColor: '#1f2937',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  monthPickerYearToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  monthPickerSection: {
    gap: 10,
  },
  monthPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthPickerCell: {
    width: '22%',
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 10,
    alignItems: 'center',
  },
});
