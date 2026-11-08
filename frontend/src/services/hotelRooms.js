export function validRoomOccupancies(rooms) {
  return (
    Array.isArray(rooms) &&
    rooms.length >= 1 &&
    rooms.length <= 8 &&
    rooms.every(
      (room) =>
        room &&
        Number.isSafeInteger(room.adults) &&
        room.adults >= 1 &&
        room.adults <= 8 &&
        Array.isArray(room.children) &&
        room.adults + room.children.length <= 8 &&
        room.children.every(
          (age) => Number.isSafeInteger(age) && age >= 0 && age <= 17,
        ),
    )
  );
}

// Validate stored or returned room totals and derive display-only nightly averages.
export function normalizeHotelRooms(
  rooms,
  nights,
  total,
  baseTotal,
  additionalFees,
) {
  if (
    !validRoomOccupancies(rooms) ||
    !Number.isSafeInteger(nights) ||
    nights < 1
  )
    return null;
  const normalized = [];
  for (const [index, room] of rooms.entries()) {
    if (
      room.roomNumber !== index + 1 ||
      typeof room.roomName !== "string" ||
      !room.roomName.trim() ||
      !Number.isFinite(room.total) ||
      room.total <= 0 ||
      !Number.isFinite(room.baseTotal) ||
      room.baseTotal <= 0 ||
      !Number.isFinite(room.additionalFees) ||
      room.additionalFees < 0 ||
      Math.abs(room.total - room.baseTotal - room.additionalFees) >= 0.011
    )
      return null;
    normalized.push({
      roomNumber: index + 1,
      roomName: room.roomName.trim(),
      adults: room.adults,
      children: [...room.children],
      total: room.total,
      baseTotal: room.baseTotal,
      additionalFees: room.additionalFees,
      averageNightly: Math.round(Math.round(room.total * 100) / nights) / 100,
    });
  }
  const totalCents = normalized.reduce(
    (sum, room) => sum + Math.round(room.total * 100),
    0,
  );
  if (
    !Number.isSafeInteger(totalCents) ||
    totalCents !== Math.round(total * 100)
  )
    return null;
  const baseCents = normalized.reduce(
    (sum, room) => sum + Math.round(room.baseTotal * 100),
    0,
  );
  const feeCents = normalized.reduce(
    (sum, room) => sum + Math.round(room.additionalFees * 100),
    0,
  );
  if (
    (baseTotal !== undefined && baseCents !== Math.round(baseTotal * 100)) ||
    (additionalFees !== undefined &&
      feeCents !== Math.round(additionalFees * 100))
  )
    return null;
  return normalized;
}

// Count children as travelers as soon as they are added, including blank ages.
export function countRoomTravelers(rooms) {
  if (rooms.some((room) => String(room.adults).trim() === ""
    || !Number.isSafeInteger(Number(room.adults)) || Number(room.adults) < 1 || Number(room.adults) > 8)) return null;
  return rooms.reduce((sum, room) => sum + Number(room.adults) + room.children.length, 0);
}

export function roomsForTravelers(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1 || count > 64) return [{ adults: "1", children: [] }];
  return Array.from({ length: Math.ceil(count / 8) }, (_room, index) => ({
    adults: String(Math.min(8, count - index * 8)), children: [],
  }));
}
