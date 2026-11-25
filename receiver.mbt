///|
pub struct Collector {
  slots : Array[String?]
  mut received : Int32
}

///|
pub fn new_collector(total : Int32) -> Collector {
  let count = if total > 0 && total <= 1024 { total } else { 0 }
  { slots: Array::make(count, None), received: 0, }
}

///|
// A duplicate is harmless. Conflicting data for an occupied slot is rejected.
pub fn receive_frame(c : Collector, index : Int32, payload : String) -> Int32 {
  if index < 0 || index >= c.slots.length() {
    return -1
  }
  match c.slots[index] {
    Some(old) => if old == payload { c.received } else { -1 }
    None => {
      c.slots[index] = Some(payload)
      c.received += 1
      c.received
    }
  }
}

///|
pub fn frame_at(c : Collector, index : Int32) -> String {
  if index < 0 || index >= c.slots.length() {
    return ""
  }
  c.slots[index].unwrap_or("")
}

///|
test "out of order, repeated and conflicting observations" {
  let c = new_collector(3)
  assert_eq(receive_frame(c, 2, "C"), 1)
  assert_eq(receive_frame(c, 2, "C"), 1)
  assert_eq(receive_frame(c, 2, "X"), -1)
  assert_eq(receive_frame(c, 0, "A"), 2)
  assert_eq(receive_frame(c, 1, "B"), 3)
  assert_eq(frame_at(c, 2), "C")
}
