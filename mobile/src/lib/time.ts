function getSeoulDateParts(isoString: string) {
  const date = new Date(isoString);
  const seoulDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  return {
    month: seoulDate.getUTCMonth() + 1,
    day: seoulDate.getUTCDate(),
    hour: String(seoulDate.getUTCHours()).padStart(2, '0'),
    minute: String(seoulDate.getUTCMinutes()).padStart(2, '0'),
  };
}

export function addHours(isoString: string, hours: number) {
  const date = new Date(isoString);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function addMinutes(isoString: string, minutes: number) {
  const date = new Date(isoString);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

export function formatKoreanDateTime(isoString: string) {
  const { month, day, hour, minute } = getSeoulDateParts(isoString);

  return `${month}/${day} ${hour}:${minute}`;
}

export function formatKoreanTime(isoString: string) {
  const { hour, minute } = getSeoulDateParts(isoString);

  return `${hour}:${minute}`;
}
