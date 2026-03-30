import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TodayTaskItem } from '../data/tasks';
import {
  getTaskStatusLabel,
  getTaskStatusTone,
} from '../features/tasks/task-presentation';
import type { AppTheme } from '../theme';

type TaskItemCardProps = {
  item: TodayTaskItem;
  actionLabel?: string | null;
  onPress?: () => void;
  secondaryActionLabel?: string | null;
  onSecondaryPress?: () => void;
  onDeletePress?: () => void;
  openedAtLabel?: string | null;
  checkedAtLabel?: string | null;
  reminderEndAtLabel?: string | null;
  theme: AppTheme;
};

export function TaskItemCard({
  item,
  actionLabel,
  onPress,
  secondaryActionLabel,
  onSecondaryPress,
  onDeletePress,
  openedAtLabel,
  checkedAtLabel,
  reminderEndAtLabel,
  theme,
}: TaskItemCardProps) {
  const styles = createStyles(theme);
  // 오늘 목록과 달력 상세가 같은 카드 UI를 쓰도록 공통 렌더링만 담당한다.
  const tone = getTaskStatusTone(item.status);
  const getButtonTone = (label: string) => {
    if (label === '완료') {
      return 'done';
    }

    if (label === '예정') {
      return 'pending';
    }

    return 'inProgress';
  };
  const primaryTone = actionLabel ? getButtonTone(actionLabel) : null;
  const secondaryTone = secondaryActionLabel ? getButtonTone(secondaryActionLabel) : null;

  return (
    <View style={styles.taskCard}>
      {onDeletePress ? (
        <Pressable
          style={styles.deleteIconButton}
          onPress={onDeletePress}
          hitSlop={10}
          pressRetentionOffset={10}
        >
          <Text style={styles.deleteIconText}>X</Text>
        </Pressable>
      ) : null}
      <View style={styles.taskMeta}>
        <View style={styles.taskBadgeRow}>
          <View
            style={[
              styles.statusBadge,
              tone === 'done'
                ? styles.statusBadgeDone
                : tone === 'inProgress'
                  ? styles.statusBadgeInProgress
                  : styles.statusBadgePending,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                tone === 'done'
                  ? styles.statusBadgeDoneText
                  : tone === 'inProgress'
                    ? styles.statusBadgeInProgressText
                    : styles.statusBadgePendingText,
              ]}
            >
              {getTaskStatusLabel(item.status)}
            </Text>
          </View>
          <View style={styles.taskCategoryBadge}>
            <Text style={styles.taskCategory}>{item.task.category}</Text>
          </View>
        </View>
        <View style={styles.taskHeaderRow}>
          <Text style={styles.taskTitle}>{item.task.title}</Text>
        </View>
        {openedAtLabel ? <Text style={styles.taskRepeat}>시작시간: {openedAtLabel}</Text> : null}
        {checkedAtLabel ? <Text style={styles.taskRepeat}>완료시간: {checkedAtLabel}</Text> : null}
        {reminderEndAtLabel ? (
          <Text style={styles.taskRepeat}>알림 종료시간: {reminderEndAtLabel}</Text>
        ) : null}
      </View>
      <View style={styles.actionColumn}>
        {secondaryActionLabel && onSecondaryPress && actionLabel && onPress ? (
          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.statusButton,
                secondaryTone === 'done'
                  ? styles.doneStatusButton
                  : secondaryTone === 'pending'
                    ? styles.pendingStatusButton
                    : styles.inProgressStatusButton,
                styles.compactStatusButton,
              ]}
              onPress={onSecondaryPress}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  secondaryTone === 'done'
                    ? styles.doneStatusButtonText
                    : secondaryTone === 'pending'
                      ? styles.pendingStatusButtonText
                      : styles.inProgressStatusButtonText,
                ]}
              >
                {secondaryActionLabel}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.statusButton,
                primaryTone === 'done'
                  ? styles.doneStatusButton
                  : primaryTone === 'pending'
                    ? styles.pendingStatusButton
                    : styles.inProgressStatusButton,
                styles.compactStatusButton,
              ]}
              onPress={onPress}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  primaryTone === 'done'
                    ? styles.doneStatusButtonText
                    : primaryTone === 'pending'
                      ? styles.pendingStatusButtonText
                      : styles.inProgressStatusButtonText,
                ]}
              >
                {actionLabel}
              </Text>
            </Pressable>
          </View>
        ) : actionLabel && onPress ? (
          <Pressable
            style={[
              styles.statusButton,
              primaryTone === 'done'
                ? styles.doneStatusButton
                : primaryTone === 'pending'
                  ? styles.pendingStatusButton
                  : styles.inProgressStatusButton,
            ]}
            onPress={onPress}
          >
            <Text
              style={[
                styles.statusButtonText,
                primaryTone === 'done'
                  ? styles.doneStatusButtonText
                  : primaryTone === 'pending'
                    ? styles.pendingStatusButtonText
                    : styles.inProgressStatusButtonText,
              ]}
            >
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  taskCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBackground,
    padding: 18,
    alignItems: 'flex-start',
    position: 'relative',
  },
  taskMeta: {
    flex: 1,
    gap: 8,
  },
  taskBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskHeaderRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  taskTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  taskCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.categoryBackground,
  },
  taskCategory: {
    color: theme.colors.categoryText,
    fontWeight: '600',
  },
  taskRepeat: {
    color: theme.colors.textSoft,
    fontSize: 13,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgePending: {
    backgroundColor: theme.colors.pendingBadgeBackground,
  },
  statusBadgePendingText: {
    color: theme.colors.pendingBadgeText,
  },
  statusBadgeInProgress: {
    backgroundColor: theme.colors.inProgressBadgeBackground,
  },
  statusBadgeInProgressText: {
    color: theme.colors.inProgressBadgeText,
  },
  statusBadgeDone: {
    backgroundColor: theme.colors.doneBadgeBackground,
  },
  statusBadgeDoneText: {
    color: theme.colors.doneBadgeText,
  },
  statusButton: {
    minWidth: 100,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionColumn: {
    gap: 8,
    alignItems: 'stretch',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingRight: 0,
  },
  compactStatusButton: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingStatusButton: {
    backgroundColor: theme.colors.pendingButtonBackground,
  },
  pendingStatusButtonText: {
    color: theme.colors.pendingButtonText,
  },
  inProgressStatusButton: {
    backgroundColor: theme.colors.inProgressButtonBackground,
  },
  inProgressStatusButtonText: {
    color: theme.colors.inProgressButtonText,
  },
  doneStatusButton: {
    backgroundColor: theme.colors.doneButtonBackground,
  },
  doneStatusButtonText: {
    color: theme.colors.doneButtonText,
  },
  statusButtonText: {
    fontWeight: '700',
  },
  deleteIconButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.destructiveBorder,
    backgroundColor: theme.colors.destructiveBackground,
    zIndex: 2,
  },
  deleteIconText: {
    color: theme.colors.destructiveText,
    fontSize: 12,
    fontWeight: '700',
  },
});
