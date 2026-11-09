function HotelRoomBreakdown({ rooms, nights }) {
  if (!rooms?.length || !Number.isSafeInteger(nights) || nights < 1)
    return null;
  return (
    <div className="hotel-room-breakdown">
      <p>
        {rooms.length} room{rooms.length === 1 ? "" : "s"} for {nights} nights.
        Nightly prices are averages over the stay.
      </p>
      <ul>
        {rooms.map((room) => (
          <li key={room.roomNumber}>
            <strong>
              Room {room.roomNumber}: {room.roomName}
            </strong>
            <p>
              {room.adults} adult{room.adults === 1 ? "" : "s"}
              {room.children.length > 0 &&
                `, children ages ${room.children.join(", ")}`}
            </p>
            <p>
              $
              {(
                Math.round(Math.round(room.total * 100) / nights) / 100
              ).toFixed(2)}{" "}
              USD average per night for this room
            </p>
            <p>
              ${room.total.toFixed(2)} USD room total for the stay, including $
              {room.additionalFees.toFixed(2)} in reported additional fees.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HotelRoomBreakdown;
