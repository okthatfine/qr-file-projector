///|
pub fn write_wire(
  hash : String,
  name : String,
  length : Int32,
  width : Int32,
  index : Int32,
  payload : String,
) -> String {
  @json.to_json(("QFP1", hash, name, length, width, index, payload)).stringify()
}

///|
fn valid_hash(hash : String) -> Bool {
  hash.length() == 64 &&
  hash.iter().all(fn(c) { (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') })
}

///|
// Pass validated fields to the caller only after all checks have succeeded.
pub fn read_wire(
  text : String,
  accept : (String, String, Int32, Int32, Int32, String, Int32) -> Unit,
) -> String {
  guard text.length() <= 1600 else { return "无法识别的帧" }
  let json = @json.parse(text, max_nesting_depth=2) catch {
    _ => return "无法识别的帧"
  }
  let row : (String, String, String, Int32, Int32, Int32, String) = @json.from_json(
    json,
  ) catch {
    _ => return "未知帧格式"
  }
  let (marker, hash, name, length, width, index, payload) = row
  guard marker == "QFP1" else { return "未知帧格式" }
  let total = chunk_count(length, width)
  guard valid_hash(hash) &&
    name.length() > 0 &&
    name.length() <= 96 &&
    total > 0 &&
    width >= 64 else {
    return "无效文件描述"
  }
  guard index >= 0 && index < total else { return "无效块号" }
  let bytes = @base64.decode(payload) catch { _ => return "无效数据块" }
  let expected = chunk_end(length, width, index) -
    chunk_start(length, width, index)
  guard bytes.length() == expected && @base64.encode(bytes) == payload else {
    return "无效数据块"
  }
  accept(hash, name, length, width, index, payload, total)
  ""
}
