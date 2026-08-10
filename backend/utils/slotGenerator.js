export const to24HourFormat = (time12) => {
  const [time, modifier] = time12.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};


// Convert 24-hour format to 12-hour format
export const to12HourFormat = (time24) => {
  if (!time24) return null;
  
  const [hourStr, minute] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour === 0 ? 12 : hour;
  
  return `${hour}:${minute} ${ampm}`;
};

// Generate 15-minute time slots
export const generateTimeSlots = (startTime, endTime, interval = 15) => {
  const slots = [];
  const start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);
  
  let current = new Date(start);
  
  while (current < end) {
    const next = new Date(current.getTime() + interval * 60000);
    
    // Stop if next slot exceeds end time
    if (next > end) break;
    
    const startTimeStr = current.toTimeString().slice(0, 5);
    const endTimeStr = next.toTimeString().slice(0, 5);
    
    slots.push({
      startTime: startTimeStr,
      endTime: endTimeStr,
      displayTime: `${to12HourFormat(startTimeStr)} - ${to12HourFormat(endTimeStr)}`
    });
    
    current = next;
  }
  
  return slots;
};

// Check if two time ranges overlap
export const doTimeRangesOverlap = (range1, range2) => {
  const [start1, end1] = range1;
  const [start2, end2] = range2;
  
  return start1 < end2 && start2 < end1;
};

// Calculate duration in minutes
export const calculateDuration = (startTime, endTime) => {
  const start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);
  return (end - start) / (1000 * 60);
};
