import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
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
  useColorScheme,
  View,
} from 'react-native';

import { initializeDatabase } from './src/data/database';
import {
  getThemePreference,
  setThemePreferenceSetting,
} from './src/data/settings';
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
  updateReminderRule,
} from './src/data/reminders';
import type {
  ReminderRule,
  Task,
  TaskCategory,
  TaskRepeatType,
} from './src/domain/types';
import {
  addDays,
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
import { getAppTheme, type AppTheme, type ThemePreference } from './src/theme';

type AppTab = (typeof tabs)[number]['key'];

const iconStyles = StyleSheet.create({
  iconToday: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTodayRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  iconTodayDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  iconCalendarSvgWrap: {
    width: 22,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconTasks: {
    width: 22,
    height: 20,
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  iconTasksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconTasksBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1.5,
  },
  iconTasksLine: {
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  iconBell: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconBellBody: {
    width: 16,
    height: 14,
    borderWidth: 2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  iconBellClapper: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  iconBellBase: {
    width: 10,
    height: 2,
    borderRadius: 999,
    marginTop: 2,
  },
});

function BottomTabIcon({
  tab,
  selected,
  theme,
}: {
  tab: AppTab;
  selected: boolean;
  theme: AppTheme;
}) {
  const stroke = selected ? theme.colors.iconSelected : theme.colors.iconUnselected;
  const fill = selected ? theme.colors.iconSelected : theme.colors.iconUnselected;

  if (tab === 'today') {
    return (
      <View style={iconStyles.iconToday}>
        <View style={[iconStyles.iconTodayRing, { borderColor: stroke }]} />
        <View style={[iconStyles.iconTodayDot, { backgroundColor: fill }]} />
      </View>
    );
  }

  if (tab === 'calendar') {
    return (
      <View style={iconStyles.iconCalendarSvgWrap}>
        <Svg width={20} height={20} viewBox="0 -960 960 960">
          <Path
            d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-188.5-11.5Q280-423 280-440t11.5-28.5Q303-480 320-480t28.5 11.5Q360-457 360-440t-11.5 28.5Q337-400 320-400t-28.5-11.5ZM640-400q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-188.5-11.5Q280-263 280-280t11.5-28.5Q303-320 320-320t28.5 11.5Q360-297 360-280t-11.5 28.5Q337-240 320-240t-28.5-11.5ZM640-240q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z"
            fill={selected ? theme.colors.iconSelected : theme.colors.iconUnselected}
          />
        </Svg>
      </View>
    );
  }

  if (tab === 'tasks') {
    return (
      <View style={iconStyles.iconTasks}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={iconStyles.iconTasksRow}>
            <View style={[iconStyles.iconTasksBullet, { borderColor: stroke }]} />
            <View style={[iconStyles.iconTasksLine, { backgroundColor: stroke }]} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={iconStyles.iconBell}>
      <View style={[iconStyles.iconBellBody, { borderColor: stroke }]} />
      <View style={[iconStyles.iconBellClapper, { backgroundColor: fill }]} />
      <View style={[iconStyles.iconBellBase, { backgroundColor: stroke }]} />
    </View>
  );
}

function getCalendarCompletionTone(theme: AppTheme, completionRate: number) {
  if (completionRate <= 0) {
    return null;
  }

  if (theme.name === 'light') {
    if (completionRate < 0.3) {
      return {
        backgroundColor: '#fff7ed',
        borderColor: '#fdba74',
        dayColor: '#9a3412',
      };
    }

    if (completionRate < 0.7) {
      return {
        backgroundColor: '#ecfccb',
        borderColor: '#84cc16',
        dayColor: '#3f6212',
      };
    }

    if (completionRate < 1) {
      return {
        backgroundColor: '#dcfce7',
        borderColor: '#4ade80',
        dayColor: '#166534',
      };
    }

    return {
      backgroundColor: '#bbf7d0',
      borderColor: '#22c55e',
      dayColor: '#14532d',
    };
  }

  if (completionRate < 0.3) {
    return {
      backgroundColor: '#4a3312',
      borderColor: '#a16207',
      dayColor: '#fef3c7',
    };
  }

  if (completionRate < 0.7) {
    return {
      backgroundColor: '#365314',
      borderColor: '#4d7c0f',
      dayColor: '#ecfccb',
    };
  }

  if (completionRate < 1) {
    return {
      backgroundColor: '#14532d',
      borderColor: '#15803d',
      dayColor: '#dcfce7',
    };
  }

  return {
    backgroundColor: '#166534',
    borderColor: '#16a34a',
    dayColor: '#f0fdf4',
  };
}

export default function App() {
  const colorScheme = useColorScheme();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [themePreference, setThemePreference] = useState<ThemePreference>('SYSTEM');
  const theme = getAppTheme(colorScheme, themePreference);
  const styles = createStyles(theme);
  const [showTaskHelp, setShowTaskHelp] = useState(false);
  const [permissionLabel, setPermissionLabel] = useState(
    isExpoGo() ? 'Expo Go에서는 알림이 비활성화됩니다.' : '알림 권한 확인 필요'
  );
  const [todayItems, setTodayItems] = useState<TodayTaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [availableCategories, setAvailableCategories] = useState<TaskCategory[]>(categories);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('기타');
  const [repeatType, setRepeatType] = useState<TaskRepeatType>('DAILY');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(getMonthStart(toDateKey(new Date())));
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
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [ruleDelayMinutes, setRuleDelayMinutes] = useState('60');
  const [ruleRepeatMinutes, setRuleRepeatMinutes] = useState('3');
  const [ruleMaxAlertCount, setRuleMaxAlertCount] = useState('5');
  const [ruleMessage, setRuleMessage] = useState('');
  const [ruleFeedback, setRuleFeedback] = useState('');
  const [savingRule, setSavingRule] = useState(false);
  const [settingsCategoryDraft, setSettingsCategoryDraft] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  const today = toDateKey(new Date());
  const todayDoneCount = todayItems.filter((item) => item.status === 'DONE').length;
  const todayInProgressCount = todayItems.filter((item) => item.status === 'IN_PROGRESS').length;
  const todayPendingCount = todayItems.filter((item) => item.status === 'PENDING').length;
  const activeCalendarFilterCount =
    (calendarStatusFilter === 'ALL' ? 0 : 1) + (calendarCategoryFilter === 'ALL' ? 0 : 1);
  const monthGrid = buildMonthGrid(visibleMonth);
  const calendarGrid = monthGrid;
  const visibleCalendarLabel = getMonthLabel(visibleMonth);
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
      stats?: Array<{ label: string; value: string; tone?: 'pending' | 'inProgress' | 'done' }>;
    }
  > = {
    today: {
      eyebrow: '',
      title: '오늘',
      subtitle:
        todayItems.length > 0
          ? `${todayDoneCount}개 완료, ${todayInProgressCount}개 진행 중`
          : '오늘 표시할 루틴이 없습니다.',
      stats: [
        { label: '예정', value: `${todayPendingCount}`, tone: 'pending' },
        { label: '진행중', value: `${todayInProgressCount}`, tone: 'inProgress' },
        { label: '완료', value: `${todayDoneCount}`, tone: 'done' },
      ],
    },
    calendar: {
      eyebrow: '',
      title: '기록',
      subtitle: '',
    },
    tasks: {
      eyebrow: '',
      title: '루틴',
      subtitle: editingTaskId ? '수정 중' : '',
    },
    settings: {
      eyebrow: '',
      title: '설정',
      subtitle: '테마와 옵션을 정리하세요.',
    },
  };

  function resetTaskForm() {
    setEditingTaskId(null);
    setTitle('');
    setCategory('기타');
    setRepeatType('DAILY');
    setRepeatDays([1, 2, 3, 4, 5]);
    setShowReminderSettings(false);
    setRuleFeedback('');
    resetReminderForm();
  }

  function resetReminderForm() {
    setRuleDelayMinutes('60');
    setRuleRepeatMinutes('3');
    setRuleMaxAlertCount('5');
    setRuleMessage('');
  }

  function moveCalendar(amount: number) {
    const nextMonth = shiftMonth(visibleMonth, amount);
    const nextSelectedDate = nextMonth;
    setVisibleMonth(nextMonth);
    void handleSelectDate(nextSelectedDate, nextMonth);
  }

  function jumpToToday() {
    setVisibleMonth(getMonthStart(today));
    void handleSelectDate(today, getMonthStart(today));
  }

  function resetCalendarFilters() {
    setCalendarStatusFilter('ALL');
    setCalendarCategoryFilter('ALL');
  }

  function addCategoryOption() {
    const nextCategory = settingsCategoryDraft.trim();
    if (!nextCategory) {
      setSettingsMessage('카테고리 이름을 입력해주세요.');
      return;
    }

    if (availableCategories.includes(nextCategory)) {
      setSettingsMessage('이미 있는 카테고리입니다.');
      return;
    }

    setAvailableCategories((prev) => [...prev, nextCategory]);
    setSettingsCategoryDraft('');
    setSettingsMessage(`"${nextCategory}" 카테고리를 추가했습니다.`);
  }

  function removeCategoryOption(targetCategory: TaskCategory) {
    if (targetCategory === '기타') {
      setSettingsMessage('"기타" 카테고리는 기본값으로 유지됩니다.');
      return;
    }

    if (tasks.some((task) => task.category === targetCategory)) {
      setSettingsMessage('활성 루틴에서 사용 중인 카테고리는 제거할 수 없습니다.');
      return;
    }

    setAvailableCategories((prev) => prev.filter((item) => item !== targetCategory));

    if (category === targetCategory) {
      setCategory('기타');
    }

    if (calendarCategoryFilter === targetCategory) {
      setCalendarCategoryFilter('ALL');
    }

    setSettingsMessage(`"${targetCategory}" 카테고리를 제거했습니다.`);
  }

  function openMonthPicker() {
    setMonthPickerYear(fromDateKey(visibleMonth).getFullYear());
    setShowMonthPicker(true);
  }

  function shiftMonthPickerYear(amount: number) {
    setMonthPickerYear((prev) => prev + amount);
  }

  function getTaskTimeLabels(item: TodayTaskItem) {
    const openedAtText = item.ticket.openedAt
      ? formatOptionalTime(item.ticket.openedAt)
      : null;
    const completedAtText =
      item.status === 'DONE' ? formatOptionalTime(item.checkedAt) : null;

    if (item.status === 'DONE' && openedAtText && completedAtText) {
      return {
        timeSummaryLabel: `${openedAtText} ~ ${completedAtText}`,
        openedAtLabel: null,
        checkedAtLabel: null,
      };
    }

    if (item.status === 'IN_PROGRESS' && openedAtText) {
      return {
        timeSummaryLabel: null,
        openedAtLabel: openedAtText,
        checkedAtLabel: null,
      };
    }

    if (item.status === 'DONE' && completedAtText) {
      return {
        timeSummaryLabel: null,
        openedAtLabel: null,
        checkedAtLabel: completedAtText,
      };
    }

    return {
      timeSummaryLabel: null,
      openedAtLabel: null,
      checkedAtLabel: null,
    };
  }

  async function handleThemePreferencePress(nextPreference: ThemePreference) {
    setThemePreference(nextPreference);

    try {
      await setThemePreferenceSetting(nextPreference);
    } catch {
      setSettingsMessage('테마 설정을 저장하지 못했습니다.');
    }
  }

  function handleTabPress(nextTab: AppTab) {
    if (activeTab !== nextTab) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }

    setActiveTab(nextTab);
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
        const savedThemePreference = await getThemePreference();
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

        setThemePreference(savedThemePreference);
        setTodayItems(items);
        setSelectedItems(items);
        setCalendarItemsByDate(itemsByDate);
        setTasks(allTasks);
        setRules(allRules);
        setAvailableCategories((prev) =>
          Array.from(new Set([...prev, ...allTasks.map((task) => task.category)])).sort(
            (left, right) => {
              if (left === '기타') {
                return 1;
              }

              if (right === '기타') {
                return -1;
              }

              return left.localeCompare(right, 'ko');
            }
          )
        );
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
    if (activeTab !== 'tasks' || !showReminderSettings || isExpoGo()) {
      return;
    }

    void syncNotificationPermission(true);
  }, [activeTab, showReminderSettings]);

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
    setRuleFeedback('');

    try {
      let savedTaskId = editingTaskId;

      if (editingTaskId) {
        await updateTask(editingTaskId, {
          title: normalizedTitle,
          category,
          repeatType,
          repeatDays,
        });
      } else {
        const createdTask = await createTask({
          title: normalizedTitle,
          category,
          repeatType,
          repeatDays,
          startDate: today,
        });
        savedTaskId = createdTask.id;
      }

      if (savedTaskId) {
        await saveTaskWithReminderSettings(savedTaskId);
      }

      await refreshTaskViews(selectedDate, visibleMonth);
      await refreshMetadata();

      resetTaskForm();
      setFormMessage(editingTaskId ? '루틴을 수정했습니다.' : '새 루틴을 추가했습니다.');
    } catch (error) {
      if (error instanceof Error && error.message === 'ONLY_ONE_REMINDER_RULE_PER_TASK') {
        setRuleFeedback('루틴당 알림 설정은 1개만 연결할 수 있습니다.');
      } else if (error instanceof Error && error.message) {
        setRuleFeedback(error.message);
      }
      setFormMessage(editingTaskId ? '루틴 수정 중 오류가 발생했습니다.' : '루틴 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingTask(false);
    }
  }

  function validateReminderSettings() {
    const delayMinutes = Number(ruleDelayMinutes);
    const repeatMinutes = Number(ruleRepeatMinutes);
    const maxAlertCount = Number(ruleMaxAlertCount);

    if (!Number.isFinite(delayMinutes) || delayMinutes < 1) {
      return { error: '지연 시간은 최소 1분 이상이어야 합니다.' };
    }

    if (!Number.isFinite(repeatMinutes) || repeatMinutes <= 0 || repeatMinutes > 10) {
      return { error: '반복 간격은 1분 이상 10분 이하만 설정할 수 있습니다.' };
    }

    if (!Number.isFinite(maxAlertCount) || maxAlertCount <= 0 || maxAlertCount > 10) {
      return { error: '최대 알림 횟수는 1회 이상 10회 이하만 설정할 수 있습니다.' };
    }

    if (!ruleMessage.trim()) {
      return { error: '알림 메시지를 입력해주세요.' };
    }

    return {
      delayMinutes,
      repeatMinutes,
      maxAlertCount,
    };
  }

  function handleEditTask(task: Task) {
    const linkedRule = rules.find((rule) => rule.templateId === task.id);
    setEditingTaskId(task.id);
    setTitle(task.title);
    setCategory(task.category);
    setRepeatType(task.repeatType);
    setRepeatDays(task.repeatType === 'WEEKLY_DAYS' ? task.repeatDays : [1, 2, 3, 4, 5]);
    if (linkedRule) {
      setShowReminderSettings(true);
      setRuleDelayMinutes(String(linkedRule.delayMinutes));
      setRuleRepeatMinutes(String(linkedRule.repeatIntervalMinutes ?? 3));
      setRuleMaxAlertCount(String(linkedRule.maxAlertCount));
      setRuleMessage(linkedRule.message);
    } else {
      setShowReminderSettings(false);
      resetReminderForm();
    }
    setRuleFeedback('');
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

    if (editingTaskId === task.id) {
      resetTaskForm();
    }

    setFormMessage('루틴을 비활성화했습니다.');
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

  async function saveTaskWithReminderSettings(taskId: string) {
    const existingRule = rules.find((rule) => rule.templateId === taskId);

    if (!showReminderSettings) {
      if (existingRule) {
        await deleteReminderEventsForTask(taskId);
        await deactivateReminderRule(existingRule.id);
      }
      return;
    }

    const validated = validateReminderSettings();
    if ('error' in validated) {
      throw new Error(validated.error);
    }

    if (existingRule) {
      await deleteReminderEventsForTask(taskId);
      await updateReminderRule(existingRule.id, {
        delayMinutes: validated.delayMinutes,
        repeatIntervalMinutes: validated.repeatMinutes,
        maxAlertCount: validated.maxAlertCount,
        message: ruleMessage,
      });
      return;
    }

    await createReminderRule({
      templateId: taskId,
      delayMinutes: validated.delayMinutes,
      repeatIntervalMinutes: validated.repeatMinutes,
      maxAlertCount: validated.maxAlertCount,
      message: ruleMessage,
    });
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
        {activeTab !== 'calendar' ? (
          <View style={styles.hero}>
            <View style={styles.heroBar}>
              <View style={styles.heroBarTitleRow}>
                <View style={styles.heroBarIconWrap}>
                  <BottomTabIcon tab={activeTab} selected theme={theme} />
                </View>
                <Text style={styles.heroBarTitle}>{heroContent[activeTab].title}</Text>
              </View>
              {heroContent[activeTab].eyebrow ? (
                <Text style={styles.eyebrow}>{heroContent[activeTab].eyebrow}</Text>
              ) : null}
            </View>
            {heroContent[activeTab].subtitle ? (
              <Text style={styles.subtitle}>{heroContent[activeTab].subtitle}</Text>
            ) : null}
            {activeTab === 'today' && heroContent.today.stats ? (
              <View style={styles.heroStatsRow}>
                {heroContent.today.stats.map((stat) => (
                  <View
                    key={stat.label}
                    style={[
                      styles.heroStatCard,
                      stat.tone === 'pending'
                        ? styles.heroStatCardPending
                        : stat.tone === 'inProgress'
                          ? styles.heroStatCardInProgress
                          : stat.tone === 'done'
                            ? styles.heroStatCardDone
                            : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.heroStatLabel,
                        stat.tone === 'pending'
                          ? styles.heroStatLabelPending
                          : stat.tone === 'inProgress'
                            ? styles.heroStatLabelInProgress
                            : stat.tone === 'done'
                              ? styles.heroStatLabelDone
                              : null,
                      ]}
                    >
                      {stat.label}
                    </Text>
                    <Text
                      style={[
                        styles.heroStatValue,
                        stat.tone === 'pending'
                          ? styles.heroStatValuePending
                          : stat.tone === 'inProgress'
                            ? styles.heroStatValueInProgress
                            : stat.tone === 'done'
                              ? styles.heroStatValueDone
                              : null,
                      ]}
                    >
                      {stat.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'today' ? (
          <View style={styles.panel}>
            <Text style={styles.caption}>{`${today} (${getWeekdayLabel(today)})`}</Text>
            {loadingTasks ? (
              <ActivityIndicator color={theme.colors.activityIndicator} />
            ) : (
              // 오늘 탭은 reminder 종료시간까지 함께 보여준다.
              todayItems.map((item) => {
                const timeLabels = getTaskTimeLabels(item);

                return (
                <TaskItemCard
                  key={item.task.id}
                  theme={theme}
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
                  timeSummaryLabel={timeLabels.timeSummaryLabel}
                  openedAtLabel={timeLabels.openedAtLabel}
                  checkedAtLabel={timeLabels.checkedAtLabel}
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
                );
              })
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
                  <Text style={styles.monthButtonIcon}>‹</Text>
                </Pressable>
                <Pressable style={styles.calendarTitleButton} onPress={openMonthPicker}>
                  <Text style={styles.panelTitle}>{visibleCalendarLabel}</Text>
                </Pressable>
                <View style={styles.calendarHeaderActions}>
                  <Pressable
                    style={styles.monthButton}
                    onPress={() => moveCalendar(1)}
                  >
                    <Text style={styles.monthButtonIcon}>›</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.todayPill, styles.todayPillCompact]}
                    onPress={jumpToToday}
                  >
                    <Text style={styles.todayPillText}>오늘</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.filterSection}>
                <View style={styles.filterSummaryRow}>
                  {activeCalendarFilterCount > 0 ? (
                    <Pressable style={styles.filterResetButton} onPress={resetCalendarFilters}>
                      <Text style={styles.filterResetButtonText}>필터 초기화</Text>
                    </Pressable>
                  ) : null}
                </View>
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
                    {(['ALL', ...availableCategories] as Array<'ALL' | TaskCategory>).map((item) => (
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
                style={styles.calendarGrid}
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
                  const completionRate = dayItems.length > 0 ? doneCount / dayItems.length : 0;
                  const completionTone = getCalendarCompletionTone(theme, completionRate);

                  return (
                    <Pressable
                      key={dateKey}
                      style={[
                        styles.calendarCell,
                        styles.calendarCellMonth,
                        !inCurrentMonth && styles.calendarCellMuted,
                        completionTone,
                        selected && styles.calendarCellSelected,
                        isToday && styles.calendarTodayCell,
                      ]}
                      onPress={() => handleSelectDate(dateKey)}
                    >
                      <Text
                        style={[
                          styles.calendarDay,
                          !inCurrentMonth && styles.calendarTextMuted,
                          completionTone && !selected && { color: completionTone.dayColor },
                          isToday && styles.calendarToday,
                        ]}
                      >
                        {dateKey.slice(-2)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.caption}>{`${selectedDate} · ${filteredSelectedItems.length}개`}</Text>
              {filteredSelectedItems.map((item) => {
                const timeLabels = getTaskTimeLabels(item);

                return (
                <TaskItemCard
                  key={item.ticket.id}
                  theme={theme}
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
                  timeSummaryLabel={timeLabels.timeSummaryLabel}
                  openedAtLabel={timeLabels.openedAtLabel}
                  checkedAtLabel={timeLabels.checkedAtLabel}
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
                );
              })}
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
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionEyebrow}>
                  {editingTaskId ? '루틴 수정' : '새 루틴'}
                </Text>
                {editingTaskId ? <Text style={styles.sectionMeta}>기존 내용 반영</Text> : null}
              </View>
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
                placeholderTextColor={theme.colors.placeholder}
                style={styles.input}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.fieldLabel}>카테고리</Text>
              <View style={styles.chipRow}>
                {availableCategories.map((item) => (
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

              <View style={styles.filterSummaryRow}>
                <Text style={styles.fieldLabel}>알림 설정</Text>
                <Pressable
                  style={styles.filterResetButton}
                  onPress={() => {
                    setShowReminderSettings((prev) => {
                      const next = !prev;
                      if (!next && !editingTaskId) {
                        resetReminderForm();
                        setRuleFeedback('');
                      }
                      return next;
                    });
                  }}
                >
                  <Text style={styles.filterResetButtonText}>
                    {showReminderSettings ? '접기' : '추가'}
                  </Text>
                </Pressable>
              </View>

              {showReminderSettings ? (
                <>
                  <View style={styles.helperCard}>
                    <Text style={styles.helperTitle}>선택 설정</Text>
                    <Text style={styles.helperText}>
                      루틴을 시작했을 때만 알림이 동작합니다. 필요할 때만 켜고, 저장 시 루틴과 함께 반영됩니다.
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
                    placeholderTextColor={theme.colors.placeholder}
                    returnKeyType="done"
                    onFocus={() => {
                      requestAnimationFrame(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      });
                    }}
                  />
                  {ruleFeedback ? <Text style={styles.formMessage}>{ruleFeedback}</Text> : null}
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
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionEyebrow}>활성 루틴</Text>
                <Text style={styles.sectionMeta}>{tasks.length}개</Text>
              </View>
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
                        {(() => {
                          const linkedRule = rules.find((rule) => rule.templateId === task.id);
                          if (!linkedRule) {
                            return null;
                          }

                          return (
                            <Text style={styles.taskRepeat}>
                              알림: {linkedRule.delayMinutes}분 후 / {linkedRule.repeatIntervalMinutes ?? '-'}분 간격 / 최대 {linkedRule.maxAlertCount}회
                            </Text>
                          );
                        })()}
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

        {activeTab === 'settings' ? (
          <>
            <View style={styles.panel}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionEyebrow}>테마</Text>
                <Text style={styles.sectionMeta}>
                  {themePreference === 'SYSTEM'
                    ? '시스템'
                    : themePreference === 'LIGHT'
                      ? '라이트'
                      : '네이비'}
                </Text>
              </View>
              <View style={styles.segmentedControlWide}>
                {(['SYSTEM', 'LIGHT', 'NAVY'] as ThemePreference[]).map((item) => (
                  <Pressable
                    key={item}
                    style={[
                      styles.segmentedItemFill,
                      themePreference === item && styles.segmentedItemActive,
                    ]}
                    onPress={() => void handleThemePreferencePress(item)}
                  >
                    <Text
                      style={[
                        styles.segmentedText,
                        themePreference === item
                          ? styles.segmentedTextActive
                          : styles.segmentedTextInactive,
                      ]}
                    >
                      {item === 'SYSTEM' ? '시스템' : item === 'LIGHT' ? '라이트' : '네이비'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionEyebrow}>카테고리</Text>
                <Text style={styles.sectionMeta}>{availableCategories.length}개</Text>
              </View>
              <View style={styles.settingsInputRow}>
                <TextInput
                  style={[styles.input, styles.settingsInputFlex]}
                  value={settingsCategoryDraft}
                  onChangeText={setSettingsCategoryDraft}
                  placeholder="새 카테고리 이름"
                  placeholderTextColor={theme.colors.placeholder}
                />
                <Pressable style={styles.button} onPress={addCategoryOption}>
                  <Text style={styles.buttonText}>추가</Text>
                </Pressable>
              </View>
              <View style={styles.settingsCategoryList}>
                {availableCategories.map((item) => {
                  const removable = item !== '기타' && !tasks.some((task) => task.category === item);

                  return (
                    <View key={item} style={styles.settingsCategoryRow}>
                      <View style={styles.taskCategoryBadge}>
                        <Text style={styles.taskCategory}>{item}</Text>
                      </View>
                      <Pressable
                        style={[
                          styles.filterResetButton,
                          !removable && styles.settingsActionDisabled,
                        ]}
                        onPress={() => removeCategoryOption(item)}
                        disabled={!removable}
                      >
                        <Text style={styles.filterResetButtonText}>
                          {item === '기타' ? '기본' : removable ? '삭제' : '사용중'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              {settingsMessage ? <Text style={styles.formMessage}>{settingsMessage}</Text> : null}
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionEyebrow}>알림 설정</Text>
                <Text style={styles.sectionMeta}>준비중</Text>
              </View>
              <View style={styles.helperCard}>
                <Text style={styles.helperTitle}>설정 화면 껍데기</Text>
                <Text style={styles.helperText}>
                  알림 채널, 기본 메시지, 시간대별 묶음 옵션 같은 전역 알림 설정은 다음 단계에서 연결할 예정입니다.
                </Text>
              </View>
              <View style={styles.settingsShellList}>
                <View style={styles.settingsShellRow}>
                  <Text style={styles.label}>기본 알림 사용</Text>
                  <Text style={styles.value}>추가 예정</Text>
                </View>
                <View style={styles.settingsShellRow}>
                  <Text style={styles.label}>조용한 시간대</Text>
                  <Text style={styles.value}>추가 예정</Text>
                </View>
                <View style={styles.settingsShellRow}>
                  <Text style={styles.label}>기본 메시지</Text>
                  <Text style={styles.value}>추가 예정</Text>
                </View>
              </View>
            </View>
          </>
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
              onPress={() => handleTabPress(tab.key)}
            >
              <BottomTabIcon tab={tab.key} selected={selected} theme={theme} />
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.screen,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 22,
    paddingBottom: 118,
  },
  hero: {
    marginHorizontal: -14,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: theme.colors.heroBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.heroBorder,
  },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroBarIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: theme.colors.heroIconBackground,
    borderWidth: 1,
    borderColor: theme.colors.heroIconBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: theme.colors.textSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  heroBarTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: theme.colors.heroStatBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.heroStatBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  heroStatCardPending: {
    backgroundColor: theme.colors.heroStatPendingBackground,
    borderColor: theme.colors.heroStatPendingBorder,
  },
  heroStatCardInProgress: {
    backgroundColor: theme.colors.heroStatInProgressBackground,
    borderColor: theme.colors.heroStatInProgressBorder,
  },
  heroStatCardDone: {
    backgroundColor: theme.colors.heroStatDoneBackground,
    borderColor: theme.colors.heroStatDoneBorder,
  },
  heroStatLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  heroStatLabelPending: {
    color: theme.colors.textSecondary,
  },
  heroStatLabelInProgress: {
    color: theme.colors.inProgressBadgeText,
  },
  heroStatLabelDone: {
    color: theme.colors.doneBadgeText,
  },
  heroStatValue: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  heroStatValuePending: {
    color: theme.colors.textPrimary,
  },
  heroStatValueInProgress: {
    color: theme.colors.inProgressBadgeText,
  },
  heroStatValueDone: {
    color: theme.colors.doneBadgeText,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.tabBarBorder,
    backgroundColor: theme.colors.tabBarBackground,
  },
  tabButton: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.tabButtonActive,
  },
  tabButtonInactive: {
    backgroundColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: theme.colors.textPrimary,
  },
  tabButtonTextInactive: {
    color: theme.colors.tabTextInactive,
  },
  iconToday: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTodayRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  iconTodayDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  iconCalendarSvgWrap: {
    width: 22,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconTasks: {
    width: 22,
    height: 20,
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  iconTasksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconTasksBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1.5,
  },
  iconTasksLine: {
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  iconBell: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconBellBody: {
    width: 16,
    height: 14,
    borderWidth: 2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  iconBellClapper: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  iconBellBase: {
    width: 10,
    height: 2,
    borderRadius: 999,
    marginTop: 2,
  },
  panel: {
    gap: 14,
  },
  panelTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionEyebrow: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  value: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  button: {
    marginTop: 4,
    backgroundColor: theme.colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  buttonText: {
    color: theme.colors.accentText,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  buttonFlex: {
    flex: 1,
    marginTop: 4,
    backgroundColor: theme.colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryButton: {
    marginTop: 4,
    backgroundColor: theme.colors.secondaryButtonBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.secondaryButtonBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: theme.colors.secondaryButtonText,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  item: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: theme.colors.categoryBackground,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    alignSelf: 'flex-start',
  },
  taskCategory: {
    color: theme.colors.categoryText,
    fontSize: 12,
    fontWeight: '700',
  },
  taskTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  taskRepeat: {
    color: theme.colors.textMuted,
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
    backgroundColor: theme.colors.pendingBadgeBackground,
    borderColor: theme.colors.pendingBadgeBorder,
  },
  statusBadgePendingText: {
    color: theme.colors.pendingBadgeText,
  },
  statusBadgeInProgress: {
    backgroundColor: theme.colors.inProgressBadgeBackground,
    borderColor: theme.colors.inProgressBadgeBorder,
  },
  statusBadgeInProgressText: {
    color: theme.colors.inProgressBadgeText,
  },
  statusBadgeDone: {
    backgroundColor: theme.colors.doneBadgeBackground,
    borderColor: theme.colors.doneBadgeBorder,
  },
  statusBadgeDoneText: {
    color: theme.colors.doneBadgeText,
  },
  statusButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statusPending: {
    backgroundColor: theme.colors.pendingButtonBackground,
  },
  statusDone: {
    backgroundColor: theme.colors.doneButtonBackground,
  },
  statusInProgress: {
    backgroundColor: theme.colors.inProgressButtonBackground,
  },
  deleteButton: {
    backgroundColor: theme.colors.destructiveBackground,
  },
  editButton: {
    backgroundColor: theme.colors.editButtonBackground,
  },
  flexButton: {
    flex: 1,
  },
  statusButtonText: {
    color: theme.colors.textPrimary,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  calendarHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthButton: {
    width: 42,
    height: 42,
    backgroundColor: theme.colors.monthButtonBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.monthButtonBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  monthButtonIcon: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '500',
    marginTop: -2,
  },
  calendarTitleButton: {
    flex: 1,
    alignItems: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.monthButtonBorder,
    padding: 4,
  },
  segmentedControlWide: {
    flexDirection: 'row',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.monthButtonBorder,
    padding: 3,
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
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  segmentedItemActive: {
    backgroundColor: theme.colors.accent,
  },
  segmentedText: {
    fontSize: 11,
    fontWeight: '800',
  },
  segmentedTextActive: {
    color: theme.colors.accentText,
  },
  segmentedTextInactive: {
    color: theme.colors.textSecondary,
  },
  todayPill: {
    backgroundColor: theme.colors.todayPillBackground,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.todayPillBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  todayPillCompact: {
    paddingHorizontal: 11,
    minHeight: 42,
    justifyContent: 'center',
  },
  todayPillText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekHeaderText: {
    width: '14.28%',
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    minHeight: 56,
    backgroundColor: theme.colors.calendarCellBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.calendarCellBorder,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellMonth: {
    width: '14.285%',
    marginBottom: 4,
  },
  calendarCellMuted: {
    opacity: 0.45,
  },
  calendarCellSelected: {
    borderColor: theme.colors.calendarSelectedBorder,
    borderWidth: 2,
  },
  calendarTodayCell: {
    borderColor: theme.colors.calendarTodayBorder,
    borderWidth: 2,
  },
  calendarDay: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  calendarTextMuted: {
    color: theme.colors.calendarMutedText,
  },
  calendarToday: {
    textDecorationLine: 'underline',
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
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
  settingsInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  settingsInputFlex: {
    flex: 1,
  },
  settingsCategoryList: {
    gap: 10,
  },
  settingsCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  settingsActionDisabled: {
    opacity: 0.5,
  },
  settingsShellList: {
    gap: 10,
  },
  settingsShellRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  filterSection: {
    gap: 6,
  },
  filterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  filterBlock: {
    gap: 4,
  },
  filterLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  filterChipInactive: {
    backgroundColor: theme.colors.filterChipInactiveBackground,
    borderColor: theme.colors.filterChipInactiveBorder,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: theme.colors.accentText,
  },
  filterChipTextInactive: {
    color: theme.colors.textSecondary,
  },
  filterResetButton: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.filterResetBorder,
    backgroundColor: theme.colors.filterResetBackground,
  },
  filterResetButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  compactFieldLabel: {
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  chipInactive: {
    backgroundColor: theme.colors.chipBackground,
    borderColor: theme.colors.chipBorder,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: theme.colors.accentText,
  },
  chipTextInactive: {
    color: theme.colors.textSecondary,
  },
  formMessage: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  helpToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  helpToggleText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  ruleList: {
    gap: 10,
  },
  ruleCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 12,
  },
  helperCard: {
    backgroundColor: theme.colors.helperBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 6,
  },
  confirmModalCard: {
    backgroundColor: theme.colors.modalBackground,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: theme.colors.modalBorder,
  },
  modalActionButton: {
    marginTop: 0,
  },
  helperTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: theme.colors.permissionBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  permissionText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  permissionButton: {
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  permissionButtonText: {
    color: theme.colors.accentText,
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.modalBackdrop,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    maxHeight: '75%',
    backgroundColor: theme.colors.modalBackground,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.modalBorder,
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
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.secondaryButtonBorder,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
