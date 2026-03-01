export const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getStartOfWeek = (date: Date) => {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() === 0 ? 6 : monday.getDay() - 1));
  return monday;
};

export const getWeekDays = (offset: number, startOnToday = false) => {
  const start = startOnToday ? new Date() : getStartOfWeek(new Date());
  start.setHours(0, 0, 0, 0);

  const span = startOnToday ? 5 : 7;
  const shiftDays = startOnToday ? offset : offset * 7;

  start.setDate(start.getDate() + shiftDays);

  return Array.from({ length: span }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    day.setHours(0, 0, 0, 0);
    const todayKey = formatDateKey(new Date());

    return {
      date: day,
      dateStr: formatDateKey(day),
      dayName: day.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
      dayNum: day.getDate(),
      month: day.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      year: day.getFullYear(),
      isToday: formatDateKey(day) === todayKey,
    };
  });
};

export const getWeekRangeLabel = (days: Array<{ date: Date }>) => {
  if (!days.length) return '';

  const first = days[0].date;
  const last = days[days.length - 1].date;
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  const firstLabel = first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const lastLabel = last.toLocaleDateString('en-US', sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });

  return `${firstLabel} - ${lastLabel}`;
};
