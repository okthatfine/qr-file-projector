// Ranges shown to the presenter are one-based. Adjacent missing slots become
// one interval, so the receiver can read the list aloud across a classroom.
///|
pub fn missing_ranges(session : Transfer) -> String {
  let slots = session.parts.slots
  let ranges : Array[String] = []
  let mut cursor = 0
  while cursor < slots.length() {
    if slots[cursor] is Some(_) {
      cursor += 1
      continue
    }
    let start = cursor + 1
    cursor += 1
    while cursor < slots.length() && slots[cursor] is None {
      cursor += 1
    }
    if start == cursor {
      ranges.push(start.to_string())
    } else {
      ranges.push("\{start}-\{cursor}")
    }
  }
  ranges.join(",")
}

///|
fn positive_frame_number(text : StringView, limit : Int32) -> Int32? {
  let token = text.trim()
  guard token.length() > 0 else { return None }
  let mut value = 0
  for ch in token {
    guard ch >= '0' && ch <= '9' else { return None }
    value = value * 10 + ch.to_int() - '0'.to_int()
    guard value <= limit else { return None }
  }
  if value >= 1 {
    Some(value)
  } else {
    None
  }
}

// Emit nothing on a malformed request, even when an earlier range was valid.

///|
pub fn choose_frames(
  total : Int32,
  request : String,
  emit : (Int32) -> Unit,
) -> String {
  guard total > 0 && total <= 1024 else { return "帧数超出范围" }
  if request.trim().length() == 0 {
    for index in 0..<total {
      emit(index)
    }
    return ""
  }
  guard request.length() <= 6000 else { return "补播清单过长" }
  let selected = Array::make(total, false)
  for token in request.split(",") {
    let (first, last) = match token.split_once("-") {
      None => (token, token)
      Some(pair) => pair
    }
    guard positive_frame_number(first, total) is Some(start) else {
      return "起始帧须为 1 至 \{total} 的整数"
    }
    guard positive_frame_number(last, total) is Some(end) else {
      return "结束帧须为 1 至 \{total} 的整数"
    }
    guard start <= end else { return "区间起点大于终点" }
    for offset in (start - 1)..<end {
      selected[offset] = true
    }
  }
  for index, enabled in selected {
    if enabled {
      emit(index)
    }
  }
  ""
}

// Prepare the identical wire representation used by legacy QFP1 receivers.
// A restricted broadcast keeps the original indexes and file identity.

///|
pub fn project_frames(
  bytes : Bytes,
  name : String,
  hash : String,
  width : Int32,
  request : String,
  emit : (String) -> Unit,
) -> String {
  guard valid_hash(hash) else { return "文件摘要格式不正确" }
  guard name.length() > 0 && name.length() <= 96 else {
    return "文件名须为 1 至 96 个字符"
  }
  guard width >= 64 && width <= 512 else {
    return "每块应为 64 至 512 字节"
  }
  let length = bytes.length()
  guard length <= 65536 else { return "请选择不超过 64 KiB 的文件" }
  replay_selection(request, hash, length, width, fn(index) {
    let start = chunk_start(length, width, index)
    let end = chunk_end(length, width, index)
    let payload = @base64.encode(bytes[start:end])
    emit(write_wire(hash, name, length, width, index, payload))
  })
}
