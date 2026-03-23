import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  deleteTaskTicket,
  ensureTodayTaskTickets,
  getTaskItemsForDate,
  getTaskItemsForDates,
  listActiveTasks,
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
  isSameMonth,
  shiftMonth,
  toDateKey,
} from './src/lib/date';
import { TaskItemCard } from './src/components/TaskItemCard';
import {
  deleteReminderEventsForTask,
  deleteReminderEventsForTaskTicket,
  handleReminderEventsAfterTaskStatusChange,
} from './src/features/reminders/reminder-workflow';
import {
  addReminderNotificationResponseListener,
  ensureNotificationPermissions,
  getNotificationPermissions,
  isExpoGo,
} from './src/lib/notifications';
import {
  categories,
  filterTaskItems,
  formatDelayMinutes,
  formatOptionalTime,
  formatRepeatDays,
  getNextTaskStatus,
  getStatusActionLabel,
  getWeekdayLabel,
  hasActiveReminderRule,
  tabs,
  type CalendarStatusFilter,
  weekdays,
} from './src/features/tasks/task-presentation';

type AppTab = (typeof tabs)[number]['key'];
type CalendarViewMode = 'MONTH' | 'WEEK';

export default function App() {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [showTaskHelp, setShowTaskHelp] = useState(false);
  const [showReminderHelp, setShowReminderHelp] = useState(false);
  const [permissionLabel, setPermissionLabel] = useState(
    isExpoGo() ? 'Expo Go에서는 알림이 비활성화됩니다.' : '알림 권한 확인 필요'
  );
  const [todayItems, setTodayItems] = useState<TodayTaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('운동');
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
  const [pendingDismissItem, setPendingDismissItem] = useState<TodayTaskItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<TodayTaskItem[]>([]);
  const [calendarItemsByDate, setCalendarItemsByDate] = useState<Record<string, TodayTaskItem[]>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [ruleTriggerTaskId, setRuleTriggerTaskId] = useState('');
  const [ruleDelayMinutes, setRuleDelayMinutes] = useState('60');
  const [ruleRepeatMinutes, setRuleRepeatMinutes] = useState('3');
  const [ruleMaxAlertCount, setRuleMaxAlertCount] = useState('5');
  const [ruleMessage, setRuleMessage] = useState('');
  const [ruleFeedback, setRuleFeedback] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  const today = toDateKey(new Date());
  const activeReminderRuleCount = rules.filter((rule) => rule.isActive).length;
  const todayDoneCount = todayItems.filter((item) => item.status === 'DONE').length;
  const todayInProgressCount = todayItems.filter((item) => item.status === 'IN_PROGRESS').length;
  const todayPendingCount = todayItems.filter((item) => item.status === 'PENDING').length;
  const activeCalendarFilterCount =
    (calendarStatusFilter === 'ALL' ? 0 : 1) + (calendarCategoryFilter === 'ALL' ? 0 : 1);
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
  const filteredSelectedItems = filterTaskItems(
    selectedItems,
    calendarStatusFilter,
    calendarCategoryFilter
  );
  const monthPickerLabel = `${monthPickerYear}년`;

  const heroContent: Record<
    AppTab,
    {
      eyebrow: string;
      title: string;
      subtitle: string;
      stats?: Array<{ label: string; value: string }>;
    }
  > = {
    today: {
      eyebrow: '오늘 집중',
      title: '오늘 루틴',
      subtitle:
        todayItems.length > 0
          ? `${todayDoneCount}개 완료, ${todayInProgressCount}개 진행 중`
          : '오늘 표시할 루틴이 없습니다.',
      stats: [
        { label: '완료', value: `${todayDoneCount}` },
        { label: '진행중', value: `${todayInProgressCount}` },
        { label: '예정', value: `${todayPendingCount}` },
      ],
    },
    calendar: {
      eyebrow: '기록 보기',
      title: '달력',
      subtitle: activeCalendarFilterCount > 0 ? `필터 ${activeCalendarFilterCount}개 적용됨` : '',
    },
    tasks: {
      eyebrow: '루틴 관리',
      title: '테스크',
      subtitle: editingTaskId ? '수정 중' : '',
    },
    reminders: {
      eyebrow: '알림 규칙',
      title: '알림',
      subtitle: activeReminderRuleCount > 0 ? `${activeReminderRuleCount}개 활성` : '',
    },
  };

  function resetTaskForm() {
    setEditingTaskId(null);
    setTitle('');
    setCategory('운동');
    setRepeatType('DAILY');
    setRepeatDays([1, 2, 3, 4, 5]);
  }

  function resetReminderForm() {
    setRuleDelayMinutes('60');
    setRuleRepeatMinutes('3');
    setRuleMaxAlertCount('5');
    setRuleMessage('');
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

  function resetCalendarFilters() {
    setCalendarStatusFilter('ALL');
    setCalendarCategoryFilter('ALL');
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
        await ensureTodayTaskTickets(today);

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

        setTodayItems(items);
        setSelectedItems(items);
        setCalendarItemsByDate(itemsByDate);
        setTasks(allTasks);
        setRules(allRules);

        if (allTasks[0]) {
          setRuleTriggerTaskId(allTasks[0].id);
        }
      } catch {
        if (!active) {
          return;
        }
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
    if (activeTab !== 'reminders' || isExpoGo()) {
      return;
    }

    void syncNotificationPermission(true);
  }, [activeTab]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;

    async function registerListener() {
      cleanup = await addReminderNotificationResponseListener(async ({ ticketId }) => {
        if (!active) {
          return;
        }

        await setTaskStatus(ticketId, 'DONE');
        await deleteReminderEventsForTaskTicket(ticketId);
        await refreshTaskViews(selectedDate, visibleMonth);
        await refreshMetadata();
      });
    }

    void registerListener();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [selectedDate, visibleMonth]);

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

  async function syncNotificationPermission(requestIfNeeded: boolean) {
    const permission = requestIfNeeded
      ? await ensureNotificationPermissions()
      : await getNotificationPermissions();

    setPermissionLabel(
      isExpoGo()
        ? 'Expo Go에서는 알림이 비활성화됩니다.'
        : permission.granted
          ? '알림 권한이 허용되었습니다.'
          : permission.canAskAgain
            ? '알림 권한이 필요합니다.'
            : '알림 권한이 꺼져 있습니다. 설정에서 허용해주세요.'
    );

    return permission;
  }

  async function handlePermissionPress() {
    await syncNotificationPermission(true);
  }

  async function handleStatusPress(
    ticketId: string,
    templateId: string,
    currentStatus: TodayTaskItem['status'],
    dateKey: string,
    explicitNextStatus?: TodayTaskItem['status']
  ) {
    // 버튼 클릭 한 번으로 상태 변경과 알림 후속 처리를 함께 맞춘다.
    const hasLinkedRules = hasActiveReminderRule(rules, templateId);
    const nextStatus = explicitNextStatus ?? getNextTaskStatus(currentStatus, hasLinkedRules);
    const ticket = await setTaskStatus(ticketId, nextStatus);
    await handleReminderEventsAfterTaskStatusChange({
      ticketId,
      templateId,
      currentStatus,
      nextStatus,
      ticket,
      rules,
    });
    await refreshTaskViews(dateKey, visibleMonth);
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

    await deleteReminderEventsForTask(task.id);
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

  async function handleDismissTodayTicket(item: TodayTaskItem) {
    await deleteReminderEventsForTaskTicket(item.ticket.id);
    await deleteTaskTicket(item.ticket.id);
    await refreshTaskViews(today, visibleMonth);
  }

  async function confirmDismissTodayTicket() {
    if (!pendingDismissItem) {
      return;
    }

    await handleDismissTodayTicket(pendingDismissItem);
    setPendingDismissItem(null);
  }

  async function handleSelectDate(dateKey: string, monthKey = getMonthStart(dateKey)) {
    setSelectedDate(dateKey);
    setVisibleMonth(monthKey);
    await refreshTaskViews(dateKey, monthKey);
  }

  async function handleCreateRule() {
    const delayMinutes = Number(ruleDelayMinutes);
    const repeatMinutes = Number(ruleRepeatMinutes);
    const maxAlertCount = Number(ruleMaxAlertCount);

    if (!ruleTriggerTaskId) {
      setRuleFeedback('기준 테스크를 선택해주세요.');
      return;
    }

    if (!ruleMessage.trim()) {
      setRuleFeedback('알림 메시지를 입력해주세요.');
      return;
    }

    if (
      !Number.isFinite(delayMinutes) ||
      delayMinutes < 1
    ) {
      setRuleFeedback('지연 시간은 최소 1분 이상이어야 합니다.');
      return;
    }

    if (!Number.isFinite(repeatMinutes) || repeatMinutes <= 0 || repeatMinutes > 10) {
      setRuleFeedback('반복 간격은 1분 이상 10분 이하만 설정할 수 있습니다.');
      return;
    }

    if (!Number.isFinite(maxAlertCount) || maxAlertCount <= 0 || maxAlertCount > 10) {
      setRuleFeedback('최대 알림 횟수는 1회 이상 10회 이하만 설정할 수 있습니다.');
      return;
    }

    if (hasActiveReminderRule(rules, ruleTriggerTaskId)) {
      setRuleFeedback('테스크당 알림 규칙은 1개만 연결할 수 있습니다.');
      return;
    }

    setSavingRule(true);
    setRuleFeedback('');

    try {
      await createReminderRule({
        templateId: ruleTriggerTaskId,
        delayMinutes,
        repeatIntervalMinutes: repeatMinutes,
        maxAlertCount,
        message: ruleMessage,
      });

      const allRules = await listReminderRules();
      setRules(allRules);
      resetReminderForm();
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
    const targetRule = rules.find((rule) => rule.id === ruleId);
    if (targetRule) {
      await deleteReminderEventsForTask(targetRule.templateId);
    }
    await deactivateReminderRule(ruleId);
    await refreshMetadata();
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
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={16}
      >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{heroContent[activeTab].eyebrow}</Text>
          <Text style={styles.title}>{heroContent[activeTab].title}</Text>
          {heroContent[activeTab].subtitle ? (
            <Text style={styles.subtitle}>{heroContent[activeTab].subtitle}</Text>
          ) : null}
          {activeTab === 'today' && heroContent.today.stats ? (
            <View style={styles.heroStatsRow}>
              {heroContent.today.stats.map((stat) => (
                <View key={stat.label} style={styles.heroStatCard}>
                  <Text style={styles.heroStatLabel}>{stat.label}</Text>
                  <Text style={styles.heroStatValue}>{stat.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
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
              // 오늘 탭은 reminder 종료시간까지 함께 보여준다.
              todayItems.map((item) => (
                <TaskItemCard
                  key={item.task.id}
                  item={item}
                  actionLabel={getStatusActionLabel(
                    item,
                    hasActiveReminderRule(rules, item.task.id)
                  )}
                  secondaryActionLabel={item.status === 'IN_PROGRESS' ? '예정' : null}
                  onSecondaryPress={
                    item.status === 'IN_PROGRESS'
                      ? () =>
                          handleStatusPress(
                            item.ticket.id,
                            item.task.id,
                            item.status,
                            today,
                            'PENDING'
                          )
                      : undefined
                  }
                  checkedAtLabel={item.status === 'DONE' ? formatOptionalTime(item.checkedAt) : null}
                  onDeletePress={() => setPendingDismissItem(item)}
                  onPress={
                    item.status === 'IN_PROGRESS'
                      ? () =>
                          handleStatusPress(
                            item.ticket.id,
                            item.task.id,
                            item.status,
                            today,
                            'DONE'
                          )
                      : () =>
                            handleStatusPress(item.ticket.id, item.task.id, item.status, today)
                  }
                />
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
                <View style={styles.filterSummaryRow}>
                  <Text style={styles.fieldLabel}>달력 필터</Text>
                  {activeCalendarFilterCount > 0 ? (
                    <Pressable style={styles.filterResetButton} onPress={resetCalendarFilters}>
                      <Text style={styles.filterResetButtonText}>필터 초기화</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.caption}>
                  {activeCalendarFilterCount > 0
                    ? `${activeCalendarFilterCount}개 필터가 적용되어 있습니다.`
                    : '필요할 때만 상태나 카테고리로 좁혀 보세요.'}
                </Text>
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
                  // 달력 셀은 현재 필터가 적용된 결과만 집계해서 비율을 계산한다.
                  const dayItems = filterTaskItems(
                    calendarItemsByDate[dateKey] ?? [],
                    calendarStatusFilter,
                    calendarCategoryFilter
                  );
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
                        calendarViewMode === 'MONTH' && styles.calendarCellMonth,
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
              <Text style={styles.caption}>{`${selectedDate} · ${filteredSelectedItems.length}개`}</Text>
              {filteredSelectedItems.map((item) => (
                <TaskItemCard
                  key={item.ticket.id}
                  item={item}
                  actionLabel={getStatusActionLabel(
                    item,
                    hasActiveReminderRule(rules, item.task.id)
                  )}
                  secondaryActionLabel={item.status === 'IN_PROGRESS' ? '예정' : null}
                  onSecondaryPress={
                    item.status === 'IN_PROGRESS'
                      ? () =>
                          handleStatusPress(
                            item.ticket.id,
                            item.task.id,
                            item.status,
                            selectedDate,
                            'PENDING'
                          )
                      : undefined
                  }
                  checkedAtLabel={item.status === 'DONE' ? formatOptionalTime(item.checkedAt) : null}
                  onPress={
                    item.status === 'IN_PROGRESS'
                      ? () =>
                          handleStatusPress(
                            item.ticket.id,
                            item.task.id,
                            item.status,
                            selectedDate,
                            'DONE'
                          )
                      : () =>
                            handleStatusPress(
                              item.ticket.id,
                              item.task.id,
                              item.status,
                              selectedDate
                            )
                  }
                />
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
              <Pressable style={styles.helpToggle} onPress={() => setShowTaskHelp((prev) => !prev)}>
                <Text style={styles.helpToggleText}>
                  {showTaskHelp ? '입력 도움말 숨기기' : '입력 도움말 보기'}
                </Text>
              </Pressable>
              {showTaskHelp ? (
                <View style={styles.helperCard}>
                  <Text style={styles.helperText}>
                    루틴 전용 앱이므로 1회성 일정 없이 반복 규칙만 설정합니다. 수정 중에는 기존 흐름을 유지한 채 내용만 바꿉니다.
                  </Text>
                </View>
              ) : null}
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
                    {savingTask ? '저장 중...' : editingTaskId ? '수정 반영' : '루틴 추가'}
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
            <Pressable
              style={styles.helpToggle}
              onPress={() => setShowReminderHelp((prev) => !prev)}
            >
              <Text style={styles.helpToggleText}>
                {showReminderHelp ? '설명 숨기기' : '설명 보기'}
              </Text>
            </Pressable>
            {showReminderHelp ? (
              <View style={styles.helperCard}>
                <Text style={styles.helperText}>
                  특정 루틴이 시작된 뒤 지연 시간 기준으로 확인 알림을 보냅니다. 각 루틴에는 활성 규칙을 1개만 연결할 수 있습니다.
                </Text>
              </View>
            ) : null}

            {tasks.length > 0 ? (
              <>
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

                <View style={styles.helperCard}>
                  <Text style={styles.helperTitle}>현재 설정 미리보기</Text>
                  <Text style={styles.helperText}>
                    {triggerTaskName} 시작 후 {ruleDelayMinutes}분이 지나면 알림이 시작되고,
                    이후 {ruleRepeatMinutes}분 간격으로 최대 {ruleMaxAlertCount}회까지 반복됩니다.
                  </Text>
                </View>

                <View style={styles.permissionRow}>
                  <Text style={styles.permissionText}>{permissionLabel}</Text>
                  {!isExpoGo() ? (
                    <Pressable style={styles.permissionButton} onPress={handlePermissionPress}>
                      <Text style={styles.permissionButtonText}>권한 확인</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.inlineInputs}>
                  <View style={styles.reminderInputBox}>
                    <Text style={styles.compactFieldLabel}>지연(분)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={ruleDelayMinutes}
                      onChangeText={setRuleDelayMinutes}
                    />
                  </View>
                  <View style={styles.reminderInputBox}>
                    <Text style={styles.compactFieldLabel}>반복(분)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={ruleRepeatMinutes}
                      onChangeText={setRuleRepeatMinutes}
                    />
                  </View>
                  <View style={styles.reminderInputBox}>
                    <Text style={styles.compactFieldLabel}>최대 횟수</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={ruleMaxAlertCount}
                      onChangeText={setRuleMaxAlertCount}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>알림 메시지</Text>
                <TextInput
                  style={styles.input}
                  value={ruleMessage}
                  onChangeText={setRuleMessage}
                  placeholder="예: 체크해주세요"
                  placeholderTextColor="#6b7280"
                  returnKeyType="done"
                  onFocus={() => {
                    requestAnimationFrame(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    });
                  }}
                />

                <Pressable style={styles.button} onPress={handleCreateRule} disabled={savingRule}>
                  <Text style={styles.buttonText}>
                    {savingRule ? '저장 중...' : '알림 규칙 저장'}
                  </Text>
                </Pressable>
                {ruleFeedback ? <Text style={styles.formMessage}>{ruleFeedback}</Text> : null}
              </>
            ) : (
              <Text style={styles.emptyText}>먼저 테스크 탭에서 루틴을 추가해야 알림 규칙을 만들 수 있습니다.</Text>
            )}

            {rules.length > 0 ? (
              <View style={styles.ruleList}>
                {rules.map((rule) => {
                  const trigger = tasks.find((task) => task.id === rule.templateId)?.title ?? '-';

                  return (
                    <View key={rule.id} style={styles.ruleCard}>
                      <View style={styles.taskMeta}>
                        <Text style={styles.taskCategory}>기준 루틴: {trigger}</Text>
                        <Text style={styles.taskTitle}>{rule.message}</Text>
                        <Text style={styles.taskRepeat}>
                          {formatDelayMinutes(rule.delayMinutes)} 후 시작 /{' '}
                          {rule.repeatIntervalMinutes ?? '-'}분 간격 / 최대 {rule.maxAlertCount}회
                        </Text>
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

        <Modal
          animationType="fade"
          transparent
          visible={pendingDismissItem !== null}
          onRequestClose={() => setPendingDismissItem(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.confirmModalCard}>
              <Text style={styles.panelTitle}>오늘 테스크 삭제</Text>
              <Text style={styles.helperText}>
                {pendingDismissItem
                  ? `"${pendingDismissItem.task.title}"를 오늘 목록에서 삭제할까요? 오늘 티켓만 삭제되고 템플릿은 유지됩니다.`
                  : ''}
              </Text>
              <View style={styles.inlineActionRow}>
                <Pressable
                  style={[styles.secondaryButton, styles.flexButton, styles.modalActionButton]}
                  onPress={() => setPendingDismissItem(null)}
                >
                  <Text style={styles.secondaryButtonText}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.buttonFlex, styles.modalActionButton]}
                  onPress={() => void confirmDismissTodayTicket()}
                >
                  <Text style={styles.buttonText}>삭제</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: 8,
    gap: 6,
  },
  eyebrow: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#f9fafb',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  subtitle: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  heroStatLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
  },
  heroStatValue: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '800',
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
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadgePending: {
    backgroundColor: '#172554',
    borderColor: '#2563eb',
  },
  statusBadgePendingText: {
    color: '#bfdbfe',
  },
  statusBadgeInProgress: {
    backgroundColor: '#451a03',
    borderColor: '#f59e0b',
  },
  statusBadgeInProgressText: {
    color: '#fde68a',
  },
  statusBadgeDone: {
    backgroundColor: '#052e16',
    borderColor: '#10b981',
  },
  statusBadgeDoneText: {
    color: '#a7f3d0',
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
  },
  calendarGridWeek: {
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    gap: 0,
  },
  calendarCell: {
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
  calendarCellMonth: {
    width: '14.285%',
    marginBottom: 6,
  },
  calendarCellWeek: {
    flexGrow: 0,
    flexShrink: 0,
    width: '13.4%',
    minHeight: 118,
    alignItems: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 10,
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
  reminderInputBox: {
    flex: 1,
    gap: 6,
  },
  inlineActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterSection: {
    gap: 8,
  },
  filterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  filterResetButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: '#111827',
  },
  filterResetButtonText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '700',
  },
  compactFieldLabel: {
    color: '#d1d5db',
    fontSize: 12,
    fontWeight: '700',
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
  helpToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  helpToggleText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
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
  helperCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 14,
    gap: 6,
  },
  confirmModalCard: {
    backgroundColor: '#1f2937',
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalActionButton: {
    marginTop: 0,
  },
  helperTitle: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 20,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  permissionText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 18,
  },
  permissionButton: {
    borderRadius: 999,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  permissionButtonText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '800',
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
