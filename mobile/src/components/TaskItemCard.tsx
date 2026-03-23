import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TodayTaskItem } from '../data/tasks';
import {
  getTaskStatusLabel,
  getTaskStatusTone,
} from '../features/tasks/task-presentation';

type TaskItemCardProps = {
  item: TodayTaskItem;
  actionLabel: string;
  onPress: () => void;
  checkedAtLabel?: string | null;
  reminderEndAtLabel?: string | null;
};

export function TaskItemCard({
  item,
  actionLabel,
  onPress,
  checkedAtLabel,
  reminderEndAtLabel,
}: TaskItemCardProps) {
  // 오늘 목록과 달력 상세가 같은 카드 UI를 쓰도록 공통 렌더링만 담당한다.
  const tone = getTaskStatusTone(item.status);

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskMeta}>
        <View style={styles.taskHeaderRow}>
          <Text style={styles.taskTitle}>{item.task.title}</Text>
          <View style={styles.taskCategoryBadge}>
            <Text style={styles.taskCategory}>{item.task.category}</Text>
          </View>
        </View>
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
        {checkedAtLabel ? <Text style={styles.taskRepeat}>완료시간: {checkedAtLabel}</Text> : null}
        {reminderEndAtLabel ? (
          <Text style={styles.taskRepeat}>알림 종료시간: {reminderEndAtLabel}</Text>
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
        onPress={onPress}
      >
        <Text style={styles.statusButtonText}>{actionLabel}</Text>
      </Pressable>
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
    alignItems: 'center',
  },
  taskMeta: {
    flex: 1,
    gap: 8,
  },
  taskHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
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
    backgroundColor: '#1f2937',
  },
  statusBadgePendingText: {
    color: '#fbbf24',
  },
  statusBadgeInProgress: {
    backgroundColor: '#153e75',
  },
  statusBadgeInProgressText: {
    color: '#bfdbfe',
  },
  statusBadgeDone: {
    backgroundColor: '#14532d',
  },
  statusBadgeDoneText: {
    color: '#bbf7d0',
  },
  statusButton: {
    minWidth: 100,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPending: {
    backgroundColor: '#f59e0b',
  },
  statusInProgress: {
    backgroundColor: '#2563eb',
  },
  statusDone: {
    backgroundColor: '#10b981',
  },
  statusButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
