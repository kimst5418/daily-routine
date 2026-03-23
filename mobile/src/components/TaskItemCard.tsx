import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TodayTaskItem } from '../data/tasks';
import {
  getTaskStatusLabel,
  getTaskStatusTone,
} from '../features/tasks/task-presentation';

type TaskItemCardProps = {
  item: TodayTaskItem;
  actionLabel?: string | null;
  onPress?: () => void;
  secondaryActionLabel?: string | null;
  onSecondaryPress?: () => void;
  onDeletePress?: () => void;
  checkedAtLabel?: string | null;
  reminderEndAtLabel?: string | null;
};

export function TaskItemCard({
  item,
  actionLabel,
  onPress,
  secondaryActionLabel,
  onSecondaryPress,
  onDeletePress,
  checkedAtLabel,
  reminderEndAtLabel,
}: TaskItemCardProps) {
  // 오늘 목록과 달력 상세가 같은 카드 UI를 쓰도록 공통 렌더링만 담당한다.
  const tone = getTaskStatusTone(item.status);

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
        {checkedAtLabel ? <Text style={styles.taskRepeat}>완료시간: {checkedAtLabel}</Text> : null}
        {reminderEndAtLabel ? (
          <Text style={styles.taskRepeat}>알림 종료시간: {reminderEndAtLabel}</Text>
        ) : null}
      </View>
      <View style={styles.actionColumn}>
        {secondaryActionLabel && onSecondaryPress && actionLabel && onPress ? (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.statusButton, styles.secondaryStatusButton, styles.compactStatusButton]}
              onPress={onSecondaryPress}
            >
              <Text style={[styles.statusButtonText, styles.secondaryStatusButtonText]}>
                {secondaryActionLabel}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.statusButton, styles.primaryStatusButton, styles.compactStatusButton]}
              onPress={onPress}
            >
              <Text style={[styles.statusButtonText, styles.primaryStatusButtonText]}>
                {actionLabel}
              </Text>
            </Pressable>
          </View>
        ) : actionLabel && onPress ? (
          <Pressable
            style={[
              styles.statusButton,
              item.status === 'DONE'
                ? styles.secondaryStatusButton
                : styles.primaryStatusButton,
            ]}
            onPress={onPress}
          >
            <Text
              style={[
                styles.statusButtonText,
                item.status === 'DONE'
                  ? styles.secondaryStatusButtonText
                  : styles.primaryStatusButtonText,
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

const styles = StyleSheet.create({
  taskCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#243041',
    backgroundColor: '#101826',
    padding: 16,
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
    color: '#f9fafb',
    fontSize: 17,
    fontWeight: '700',
  },
  taskCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#1d4ed8',
  },
  taskCategory: {
    color: '#dbeafe',
    fontWeight: '600',
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
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgePending: {
    backgroundColor: '#374151',
  },
  statusBadgePendingText: {
    color: '#f9fafb',
  },
  statusBadgeInProgress: {
    backgroundColor: '#f59e0b',
  },
  statusBadgeInProgressText: {
    color: '#111827',
  },
  statusBadgeDone: {
    backgroundColor: '#10b981',
  },
  statusBadgeDoneText: {
    color: '#052e16',
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
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingRight: 12,
  },
  compactStatusButton: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryStatusButton: {
    backgroundColor: '#f59e0b',
  },
  primaryStatusButtonText: {
    color: '#111827',
  },
  secondaryStatusButton: {
    backgroundColor: '#374151',
  },
  secondaryStatusButtonText: {
    color: '#f9fafb',
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
    borderColor: '#5b2333',
    backgroundColor: '#25131a',
    zIndex: 2,
  },
  deleteIconText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
  },
});
