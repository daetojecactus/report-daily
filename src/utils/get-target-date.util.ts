export function getTargetDate(dateInput?: string | number | Date): Date {
  const date = dateInput ? new Date(dateInput) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
