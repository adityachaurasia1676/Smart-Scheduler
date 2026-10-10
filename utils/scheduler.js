// Convert "HH:mm" to minutes since midnight for easy math
export const timeToMins = (time) => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Convert minutes back to "HH:mm"
export const minsToTime = (mins) => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

// Check if two time ranges overlap
export const isOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

// Generate truly available gaps for a specific date
export const calculateFreeSlots = (dateStr, duration, availability, events, tasks) => {
  const dateObj = new Date(dateStr);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  
  const dayAvail = availability[dayName] || [];
  if (dayAvail.length === 0) return [];

  // Gather all existing commitments for this specific date
  const bookedToday = [
    ...events
      .filter(e => e.date === dateStr)
      .map(e => ({ start: timeToMins(e.startTime), end: timeToMins(e.endTime) })),
    ...tasks
      .filter(t => t.scheduledDate === dateStr && t.status !== 'Missed')
      .map(t => ({ start: timeToMins(t.scheduledStart), end: timeToMins(t.scheduledEnd) }))
  ];

  let freeSlots = [];
  
  dayAvail.forEach(window => {
    let windowStart = timeToMins(window.start);
    const windowEnd = timeToMins(window.end);
    
    // Sort bookings chronologically to process gaps
    const overlappingBookings = bookedToday
      .filter(b => isOverlap(windowStart, windowEnd, b.start, b.end))
      .sort((a, b) => a.start - b.start);

    overlappingBookings.forEach(booking => {
      // Is there a large enough gap BEFORE this booking?
      if (booking.start - windowStart >= duration) {
        freeSlots.push({ 
          start: minsToTime(windowStart), 
          end: minsToTime(booking.start), 
          date: dateStr 
        });
      }
      // Move our scanner to the end of the current booking
      windowStart = Math.max(windowStart, booking.end);
    });

    // Is there a gap AFTER all bookings until the end of the availability window?
    if (windowEnd - windowStart >= duration) {
      freeSlots.push({ 
        start: minsToTime(windowStart), 
        end: minsToTime(windowEnd), 
        date: dateStr 
      });
    }
  });

  return freeSlots;
};

// Fallback algorithm if AI fails or key is missing
export const findDeterministicSlot = (task, availableSlots) => {
  if (!availableSlots || availableSlots.length === 0) return null;
  
  // Simply pick the earliest valid slot found
  const slot = availableSlots[0]; 
  const startMins = timeToMins(slot.start);
  const endMins = startMins + Number(task.duration);
  
  return {
    recommendedStart: `${slot.date}T${slot.start}`,
    recommendedEnd: `${slot.date}T${minsToTime(endMins)}`,
    reason: 'First available slot selected by local algorithmic fallback.',
    confidence: 'high'
  };
};
