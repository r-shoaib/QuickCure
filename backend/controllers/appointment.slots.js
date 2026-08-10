// Convert 12-hour format to 24-hour format
export const to24HourFormat = (time12h) => {
  if (!time12h) return '';
  
  // Check if already in 24-hour format
  if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time12h)) {
    return time12h;
  }
  
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  
  hours = parseInt(hours);
  minutes = minutes ? parseInt(minutes) : 0;
  
  if (modifier === 'PM' && hours < 12) {
    hours += 12;
  }
  if (modifier === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Convert 24-hour format to 12-hour format
export const to12HourFormat = (time24h) => {
  if (!time24h) return '';
  
  let [hours, minutes] = time24h.split(':');
  hours = parseInt(hours);
  minutes = minutes ? parseInt(minutes) : 0;
  
  const modifier = hours >= 12 ? 'PM' : 'AM';
  let displayHours = hours % 12;
  displayHours = displayHours === 0 ? 12 : displayHours;
  
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${modifier}`;
};

// Generate time slots between start and end time
export const generateTimeSlots = (startTime, endTime, slotDuration = 15) => {
  const slots = [];
  
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  if (start >= end) {
    return slots;
  }
  
  for (let time = start; time + slotDuration <= end; time += slotDuration) {
    const slotStart = minutesToTime(time);
    const slotEnd = minutesToTime(time + slotDuration);
    
    slots.push({
      startTime: slotStart,
      endTime: slotEnd
    });
  }
  
  return slots;
};

// Helper: Convert time string to minutes
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper: Convert minutes to time string
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};