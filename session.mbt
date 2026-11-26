///|
#derive(Eq)
priv struct Manifest {
  hash : String
  name : String
  length : Int32
  width : Int32
  total : Int32
}

///|
pub struct Transfer {
  priv mut file : Manifest?
  priv mut parts : Collector
}

///|
pub fn new_transfer() -> Transfer {
  { file: None, parts: new_collector(0), }
}

///|
fn Transfer::insert(
  self : Transfer,
  file : Manifest,
  index : Int32,
  payload : String,
) -> String {
  match self.file {
    None => {
      self.file = Some(file)
      self.parts = new_collector(file.total)
    }
    Some(current) if current != file =>
      return "发现另一份文件，请先重置接收"
    _ => ()
  }
  if receive_frame(self.parts, index, payload) < 0 {
    "同一块号的数据冲突，请重新接收"
  } else {
    ""
  }
}

///|
pub fn scan_frame(session : Transfer, text : String) -> String {
  let mut result = ""
  let invalid = read_wire(text, fn(
    hash,
    name,
    length,
    width,
    index,
    payload,
    total,
  ) {
    let file = { hash, name, length, width, total, }
    result = session.insert(file, index, payload)
  })
  if invalid != "" {
    invalid
  } else {
    result
  }
}

///|
pub fn scan_count(session : Transfer) -> Int32 {
  session.parts.received
}

///|
pub fn scan_total(session : Transfer) -> Int32 {
  match session.file {
    None => 0
    Some(file) => file.total
  }
}

///|
pub fn scan_name(session : Transfer) -> String {
  match session.file {
    None => ""
    Some(file) => file.name
  }
}

///|
pub fn scan_hash(session : Transfer) -> String {
  match session.file {
    None => ""
    Some(file) => file.hash
  }
}

// Every stored slot has already passed the canonical Base64 and length checks.
// Reassemble in index order, regardless of the camera's observation order.

///|
pub fn assembled_bytes(session : Transfer) -> Bytes {
  guard session.file is Some(file) else { return b"" }
  guard session.parts.received == file.total else { return b"" }
  let output : Array[Byte] = Array(capacity=file.length)
  for slot in session.parts.slots {
    guard slot is Some(encoded) else { return b"" }
    let bytes = @base64.decode(encoded) catch { _ => return b"" }
    for byte in bytes {
      output.push(byte)
    }
  }
  Bytes::from_array(output)
}

// Store the manifest once. Only occupied slots are serialized, including the
// empty payload that represents a received zero-byte file.

///|
pub fn save_checkpoint(session : Transfer) -> String {
  guard session.file is Some(file) else { return "" }
  let occupied : Array[(Int32, String)] = []
  for index, slot in session.parts.slots {
    if slot is Some(payload) {
      occupied.push((index, payload))
    }
  }
  @json.to_json(
    ("QFC1", file.hash, file.name, file.length, file.width, occupied),
  ).stringify()
}

// Validate into a fresh transfer. A damaged import cannot change live progress.

///|
pub fn load_checkpoint(session : Transfer, text : String) -> String {
  guard text.length() <= 160000 else { return "进度文件过大" }
  let json = @json.parse(text, max_nesting_depth=4) catch {
    _ => return "进度文件不是有效的 JSON"
  }
  let record : (String, String, String, Int32, Int32, Array[(Int32, String)]) = @json.from_json(
    json,
  ) catch {
    _ => return "进度文件结构不正确"
  }
  let (version, hash, name, length, width, entries) = record
  guard version == "QFC1" else { return "不支持的进度版本" }
  let total = chunk_count(length, width)
  guard entries.length() > 0 && entries.length() <= total else {
    return "进度文件中的块数不正确"
  }
  let restored = new_transfer()
  for entry in entries {
    let (index, payload) = entry
    let before = scan_count(restored)
    let error = scan_frame(
      restored,
      write_wire(hash, name, length, width, index, payload),
    )
    guard error == "" else { return error }
    guard scan_count(restored) > before else {
      return "进度文件含重复块号"
    }
  }
  session.file = restored.file
  session.parts = restored.parts
  ""
}

// A second camera can contribute its checkpoint for the same broadcast.
// Check all overlapping slots before writing anything so a late conflict
// cannot partially change an existing session.

///|
pub fn merge_checkpoint(session : Transfer, text : String) -> String {
  let incoming = new_transfer()
  let error = load_checkpoint(incoming, text)
  guard error == "" else { return error }
  guard incoming.file is Some(manifest) else {
    return "进度文件缺少文件信息"
  }
  match session.file {
    None => {
      session.file = incoming.file
      session.parts = incoming.parts
      return ""
    }
    Some(current) if current != manifest =>
      return "进度属于另一份文件或不同块宽"
    _ => ()
  }
  for index, slot in incoming.parts.slots {
    match (session.parts.slots[index], slot) {
      (Some(old), Some(new)) if old != new =>
        return "进度文件与已收内容冲突"
      _ => ()
    }
  }
  for index, slot in incoming.parts.slots {
    if slot is Some(payload) && session.parts.slots[index] is None {
      let _ = receive_frame(session.parts, index, payload)
    }
  }
  ""
}
