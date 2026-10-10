export const getLocalDateStr = (dateObj = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const timeToMins = (time) => {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const minsToTime = (mins) => {
  const hours = Math.floor(mins / 60).toString().padStart(2, '0');
  const minutes = (mins % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const isOverlap = (start1, end1, start2, end2) => start1 < end2 && end1 > start2;

export const validateAvailabilityWindows = (windows = []) => {
  const sorted = [...windows].sort((a, b) => timeToMins(a.start) - timeToMins(b.start));
  for (const window of sorted) {
    const start = timeToMins(window.start);
    const end = timeToMins(window.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      return { valid: false, error: 'Each start time must be before its end time.' };
    }
  }
  for (let index = 1; index < sorted.length; index += 1) {
    if (timeToMins(sorted[index - 1].end) > timeToMins(sorted[index].start)) {
      return { valid: false, error: 'Availability windows cannot overlap.' };
    }
  }
  return { valid: true };
};

export const calculateFreeSlots = (dateStr, duration, availability = {}, events = [], tasks = []) => {
  const dateObj = new Date(`${dateStr}T12:00:00`);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const numericDuration = Number(duration);
  if (!Number.isFinite(numericDuration) || numericDuration <= 0) return [];

  const dayAvail = availability[dayName] || [];
  const bookedToday = [
    ...events.filter(event => event.date === dateStr).map(event => ({
      start: timeToMins(event.startTime), end: timeToMins(event.endTime)
    })),
    ...tasks.filter(task => task.scheduledDate === dateStr && task.status === 'Pending').map(task => ({
      start: timeToMins(task.scheduledStart), end: timeToMins(task.scheduledEnd)
    }))
  ].filter(booking => Number.isFinite(booking.start) && Number.isFinite(booking.end));

  const freeSlots = [];
  dayAvail.forEach(window => {
    const windowStart = timeToMins(window.start);
    const windowEnd = timeToMins(window.end);
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowStart >= windowEnd) return;
    let cursor = windowStart;
    const bookings = bookedToday
      .filter(booking => isOverlap(windowStart, windowEnd, booking.start, booking.end))
      .sort((a, b) => a.start - b.start);

    bookings.forEach(booking => {
      const bookingStart = Math.max(windowStart, booking.start);
      if (bookingStart - cursor >= numericDuration) {
        freeSlots.push({ start: minsToTime(cursor), end: minsToTime(bookingStart), date: dateStr });
      }
      cursor = Math.max(cursor, booking.end);
    });
    if (windowEnd - cursor >= numericDuration) {
      freeSlots.push({ start: minsToTime(cursor), end: minsToTime(windowEnd), date: dateStr });
    }
  });
  return freeSlots;
};

export const findDeterministicSlot = (task, availableSlots = []) => {
  const duration = Number(task?.duration);
  const slot = availableSlots.find(candidate => timeToMins(candidate.end) - timeToMins(candidate.start) >= duration);
  if (!slot || !Number.isFinite(duration) || duration <= 0) return null;
  return {
    recommendedStart: `${slot.date}T${slot.start}`,
    recommendedEnd: `${slot.date}T${minsToTime(timeToMins(slot.start) + duration)}`,
    reason: 'First valid slot selected by the local scheduler.',
    confidence: 'high'
  };
};
